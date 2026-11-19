#!/usr/bin/env node
'use strict';

// Opens (or updates) a pull request that pins this plugin's release in Super
// Productivity's in-app community plugin catalog:
//   super-productivity/super-productivity/src/assets/community-plugins.json
//
// The catalog needs { version, downloadUrl, sha256 } for the Install/Update
// button. GitHub Actions cannot push to another repository with GITHUB_TOKEN,
// so this script uses a PAT (SP_COMMUNITY_PLUGIN_TOKEN), creates/uses a fork,
// and opens the PR from a branch in that fork.
//
// Run the release workflow normally. For a local dry run:
//   DRY_RUN=1 CATALOG_FILE=community-plugins.json \
//   VERSION=0.0.10 DOWNLOAD_URL=https://example.com/plugin.zip \
//   SHA256=<64 hex chars> node scripts/open-community-plugin-pr.js

const fs = require('fs');

const API_ROOT = process.env.GITHUB_API_URL || 'https://api.github.com';
const UPSTREAM_REPOSITORY = process.env.UPSTREAM_REPOSITORY || 'super-productivity/super-productivity';
const CATALOG_PATH = process.env.CATALOG_PATH || 'src/assets/community-plugins.json';
const CATALOG_BASE_BRANCH = process.env.CATALOG_BASE_BRANCH || 'master';
const PLUGIN_ID = process.env.PLUGIN_ID || 'invoicer';
const PLUGIN_NAME = process.env.PLUGIN_NAME || 'Invoicer';
const PLUGIN_URL = process.env.PLUGIN_URL || 'https://github.com/1jamesthompson1/sp-invoicer';
const VERSION = process.env.VERSION || '';
const DOWNLOAD_URL = process.env.DOWNLOAD_URL || '';
const SHA256 = process.env.SHA256 || '';
const RELEASE_URL = process.env.RELEASE_URL || '';
const DRY_RUN = process.env.DRY_RUN === '1';

function fail(message) {
  throw new Error(message);
}

function encodePath(value) {
  return String(value)
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function assertReleaseInputs() {
  if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
    fail(`VERSION must be a numeric x.y.z version, got "${VERSION}".`);
  }
  if (!/^[a-f0-9]{64}$/i.test(SHA256)) {
    fail('SHA256 must be a 64-character hex digest.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(DOWNLOAD_URL);
  } catch (error) {
    fail(`DOWNLOAD_URL is invalid: ${error.message}`);
  }
  if (parsedUrl.protocol !== 'https:') {
    fail('DOWNLOAD_URL must use https://.');
  }
}

// Pure function so the catalog edit can be tested without GitHub access.
function updateCatalogEntry(entries, config) {
  if (!Array.isArray(entries)) {
    fail('The community plugin catalog is not a JSON array.');
  }

  const entry = entries.find(plugin => plugin && plugin.id === config.pluginId)
    || entries.find(plugin => plugin && normalizeUrl(plugin.url) === normalizeUrl(config.pluginUrl));

  if (!entry) {
    fail(`Could not find "${config.pluginId}" in the community plugin catalog.`);
  }
  if (entry.id && entry.id !== config.pluginId) {
    fail(`Catalog entry id "${entry.id}" does not match expected id "${config.pluginId}".`);
  }

  const nextRelease = {
    version: config.version,
    downloadUrl: config.downloadUrl,
    sha256: config.sha256
  };
  const hadRelease = !!(entry.release && typeof entry.release === 'object');
  const changed = entry.id !== config.pluginId
    || JSON.stringify(entry.release) !== JSON.stringify(nextRelease);

  entry.id = config.pluginId;
  entry.release = nextRelease;

  return { entry, changed, hadRelease };
}

function buildPullRequestBody(hadRelease) {
  const releaseLine = RELEASE_URL ? `\nRelease: ${RELEASE_URL}\n` : '';
  const problem = hadRelease
    ? `The \`${PLUGIN_ID}\` community plugin listing is not pinned to this release yet, so the in-app Community Plugins list cannot offer Install/Update for v${VERSION}.`
    : `The \`${PLUGIN_ID}\` community plugin listing has no pinned release, so the in-app Community Plugins list cannot offer Install for v${VERSION}.`;
  const solution = hadRelease
    ? `Bumps the \`${PLUGIN_ID}\` entry's \`release\` block to v${VERSION}:`
    : `Adds a pinned \`release\` block for v${VERSION}:`;

  return [
    '## Problem',
    '',
    problem,
    '',
    '## Solution',
    '',
    solution,
    '',
    '```json',
    JSON.stringify({
      version: VERSION,
      downloadUrl: DOWNLOAD_URL,
      sha256: SHA256
    }, null, 2),
    '```',
    releaseLine,
    `_Generated automatically by the [sp-invoicer release workflow](https://github.com/${process.env.GITHUB_REPOSITORY || '1jamesthompson1/sp-invoicer'}/blob/main/.github/workflows/release.yml)._`
  ].join('\n');
}

class GitHubApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function githubRequest(url, token, options = {}) {
  const method = options.method || 'GET';
  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'sp-invoicer-release-workflow',
      'x-github-api-version': '2022-11-28'
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data && data.message ? data.message : (data || response.statusText);
    throw new GitHubApiError(
      response.status,
      `${method} ${url} failed (${response.status}): ${message}`
    );
  }

  return data;
}

function repoUrl(repository, suffix = '') {
  const cleanSuffix = suffix ? `/${String(suffix).replace(/^\/+/, '')}` : '';
  return `${API_ROOT}/repos/${repository}${cleanSuffix}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRepository(repository, token) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const repo = await githubRequest(repoUrl(repository), token);
      if (repo && repo.default_branch) return repo;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    await sleep(2000);
  }
  fail(`Timed out waiting for fork ${repository} to become available.`);
}

async function syncFork(fork, token) {
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await githubRequest(repoUrl(fork.full_name, 'merge-upstream'), token, {
        method: 'POST',
        body: { branch: CATALOG_BASE_BRANCH }
      });
      return;
    } catch (error) {
      if (error.status === 409) {
        fail(`Fork ${fork.full_name} has diverged on ${CATALOG_BASE_BRANCH}; resolve the fork or set SP_COMMUNITY_PLUGIN_FORK to a clean fork.`);
      }
      if (error.status !== 404 && error.status !== 422) {
        throw error;
      }
      lastError = error;
      await sleep(2000);
    }
  }

  fail(`Fork ${fork.full_name} could not sync ${CATALOG_BASE_BRANCH} with ${UPSTREAM_REPOSITORY}: ${lastError ? lastError.message : 'unknown error'}`);
}

async function ensureFork(token) {
  let forkRepository = (process.env.FORK_REPOSITORY || '').trim();

  if (!forkRepository) {
    const user = await githubRequest(`${API_ROOT}/user`, token);
    const repoName = UPSTREAM_REPOSITORY.split('/')[1];
    forkRepository = `${user.login}/${repoName}`;
  }

  let fork;
  try {
    fork = await githubRequest(repoUrl(forkRepository), token);
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  if (!fork) {
    if (process.env.FORK_REPOSITORY) {
      fail(`Fork ${forkRepository} does not exist. Create it, or unset FORK_REPOSITORY to let the workflow create one.`);
    }
    console.log(`Creating fork ${forkRepository} from ${UPSTREAM_REPOSITORY}...`);
    await githubRequest(repoUrl(UPSTREAM_REPOSITORY, 'forks'), token, {
      method: 'POST',
      body: { default_branch_only: true }
    });
    fork = await waitForRepository(forkRepository, token);
  }

  const parent = fork.parent && fork.parent.full_name;
  if (!fork.fork || normalizeUrl(parent) !== normalizeUrl(UPSTREAM_REPOSITORY)) {
    fail(`${fork.full_name} is not a fork of ${UPSTREAM_REPOSITORY}.`);
  }

  // Bring the fork's base branch up to date so the release branch is based on
  // a commit the fork actually has, not just a shared upstream object.
  await syncFork(fork, token);

  return { repository: fork.full_name, owner: fork.owner.login };
}

async function main() {
  assertReleaseInputs();

  if (DRY_RUN) {
    const file = process.env.CATALOG_FILE;
    if (!file) fail('CATALOG_FILE is required when DRY_RUN=1.');
    const text = fs.readFileSync(file, 'utf8');
    const entries = JSON.parse(text);
    const result = updateCatalogEntry(entries, {
      pluginId: PLUGIN_ID,
      pluginUrl: PLUGIN_URL,
      version: VERSION,
      downloadUrl: DOWNLOAD_URL,
      sha256: SHA256
    });
    process.stdout.write(`${JSON.stringify(entries, null, 2)}${text.endsWith('\n') ? '\n' : ''}`);
    console.error(`Catalog entry ${result.changed ? 'updated' : 'already up to date'}.`);
    return;
  }

  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) fail('GH_TOKEN is required.');

  console.log(`Updating ${CATALOG_PATH} in ${UPSTREAM_REPOSITORY}...`);
  const fork = await ensureFork(token);

  const baseRef = await githubRequest(
    repoUrl(fork.repository, `git/ref/${encodePath(`heads/${CATALOG_BASE_BRANCH}`)}`),
    token
  );
  const baseSha = baseRef.object.sha;

  const [catalogFile, baseCommit] = await Promise.all([
    githubRequest(
      repoUrl(UPSTREAM_REPOSITORY, `contents/${encodePath(CATALOG_PATH)}?ref=${encodeURIComponent(baseSha)}`),
      token
    ),
    githubRequest(repoUrl(UPSTREAM_REPOSITORY, `git/commits/${baseSha}`), token)
  ]);

  if (!catalogFile || catalogFile.type !== 'file') {
    fail(`${CATALOG_PATH} is not a file in ${UPSTREAM_REPOSITORY}.`);
  }

  const originalText = Buffer.from(catalogFile.content.replace(/\s/g, ''), 'base64').toString('utf8');
  const entries = JSON.parse(originalText);
  const result = updateCatalogEntry(entries, {
    pluginId: PLUGIN_ID,
    pluginUrl: PLUGIN_URL,
    version: VERSION,
    downloadUrl: DOWNLOAD_URL,
    sha256: SHA256
  });

  if (!result.changed) {
    console.log(`Catalog already pins ${PLUGIN_ID} to ${VERSION}. Nothing to do.`);
    return;
  }

  const updatedText = `${JSON.stringify(entries, null, 2)}${originalText.endsWith('\n') ? '\n' : ''}`;
  const branch = `feat/invoicer-v${VERSION}`;
  const commitMessage = result.hadRelease
    ? `feat(plugins): bump ${PLUGIN_NAME} to ${VERSION}`
    : `feat(plugins): add install release for ${PLUGIN_NAME} ${VERSION}`;
  const pullRequestTitle = commitMessage;
  const pullRequestBody = buildPullRequestBody(result.hadRelease);

  console.log(`Creating branch ${fork.owner}:${branch}...`);
  const blob = await githubRequest(repoUrl(fork.repository, 'git/blobs'), token, {
    method: 'POST',
    body: { content: updatedText, encoding: 'utf-8' }
  });
  const tree = await githubRequest(repoUrl(fork.repository, 'git/trees'), token, {
    method: 'POST',
    body: {
      base_tree: baseCommit.tree.sha,
      tree: [{
        path: CATALOG_PATH,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      }]
    }
  });
  const commit = await githubRequest(repoUrl(fork.repository, 'git/commits'), token, {
    method: 'POST',
    body: {
      message: commitMessage,
      tree: tree.sha,
      parents: [baseSha]
    }
  });

  try {
    await githubRequest(repoUrl(fork.repository, `git/refs/heads/${encodePath(branch)}`), token, {
      method: 'PATCH',
      body: { sha: commit.sha, force: true }
    });
  } catch (error) {
    const missingRef = error.status === 404
      || (error.status === 422 && /reference does not exist/i.test(error.message));
    if (!missingRef) throw error;
    await githubRequest(repoUrl(fork.repository, 'git/refs'), token, {
      method: 'POST',
      body: { ref: `refs/heads/${branch}`, sha: commit.sha }
    });
  }

  const openPulls = await githubRequest(
    repoUrl(
      UPSTREAM_REPOSITORY,
      `pulls?state=open&head=${encodeURIComponent(`${fork.owner}:${branch}`)}&base=${encodeURIComponent(CATALOG_BASE_BRANCH)}`
    ),
    token
  );

  let pullRequest;
  if (Array.isArray(openPulls) && openPulls.length > 0) {
    pullRequest = await githubRequest(
      repoUrl(UPSTREAM_REPOSITORY, `pulls/${openPulls[0].number}`),
      token,
      { method: 'PATCH', body: { title: pullRequestTitle, body: pullRequestBody } }
    );
    console.log(`Updated existing pull request: ${pullRequest.html_url}`);
  } else {
    pullRequest = await githubRequest(repoUrl(UPSTREAM_REPOSITORY, 'pulls'), token, {
      method: 'POST',
      body: {
        title: pullRequestTitle,
        head: `${fork.owner}:${branch}`,
        base: CATALOG_BASE_BRANCH,
        body: pullRequestBody,
        maintainer_can_modify: true
      }
    });
    console.log(`Opened pull request: ${pullRequest.html_url}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Community plugin catalog\n\n${pullRequest.html_url}\n`
    );
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  buildPullRequestBody,
  updateCatalogEntry
};
