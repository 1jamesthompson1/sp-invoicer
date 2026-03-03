#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const currentTag = `v${packageJson.version}`;
const releaseDate = new Date().toISOString().split('T')[0];

try {
  const previousTag = execSync('git describe --tags --abbrev=0 HEAD^ 2>/dev/null', { encoding: 'utf8' }).trim();
  const range = `${previousTag}..HEAD`;
  const title = `Changes since ${previousTag}`;
  
  const commits = execSync(`git log --no-merges --pretty=format:'- %s (%h)' ${range}`, { encoding: 'utf8' }).trim();
  
  const newEntry = `\n## ${currentTag} (${releaseDate})\n\n${title}\n\n${commits}\n\n`;
  
  let changelog = '';
  if (fs.existsSync('CHANGELOG.md')) {
    changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  } else {
    changelog = '# Changelog\n\nAll notable changes to this project are documented in this file.\n\n<!-- changelog-entries -->\n';
  }
  
  if (!changelog.includes('<!-- changelog-entries -->')) {
    changelog += '\n<!-- changelog-entries -->\n';
  }
  
  if (!changelog.includes(`## ${currentTag} (`)) {
    changelog = changelog.replace('<!-- changelog-entries -->', `<!-- changelog-entries -->${newEntry}`);
    fs.writeFileSync('CHANGELOG.md', changelog, 'utf8');
    console.log(`Updated CHANGELOG.md for ${currentTag}`);
  }
} catch (error) {
  // First version or no previous tags
  const newEntry = `\n## ${currentTag} (${releaseDate})\n\nInitial release\n\n`;
  
  let changelog = '';
  if (fs.existsSync('CHANGELOG.md')) {
    changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
  } else {
    changelog = '# Changelog\n\nAll notable changes to this project are documented in this file.\n\n<!-- changelog-entries -->\n';
  }
  
  if (!changelog.includes('<!-- changelog-entries -->')) {
    changelog += '\n<!-- changelog-entries -->\n';
  }
  
  changelog = changelog.replace('<!-- changelog-entries -->', `<!-- changelog-entries -->${newEntry}`);
  fs.writeFileSync('CHANGELOG.md', changelog, 'utf8');
  console.log(`Updated CHANGELOG.md for ${currentTag} (initial release)`);
}
