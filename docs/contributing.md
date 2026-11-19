# Contributing

Contributions are welcome! This project has been developed by a single person with help from AI — feedback and PRs from othersare always appreciated.

## Development Setup

1. Clone the repository:

```bash
git clone https://github.com/1jamesthompson1/sp-invoicer.git
cd sp-invoicer
```

2. Install dependencies (if any are added in the future).
3. Make your changes in the `plugin/` directory.

## Building

```bash
npm run build
```

This creates a distributable ZIP file in the `dist/` directory that can be loaded into Super Productivity.

## Testing

1. Build the plugin using `npm run build`.
2. Load the built ZIP into Super Productivity via the plugin manager.
3. Test your changes.

## Automated Releases

This repo includes a GitHub Actions workflow at `.github/workflows/release.yml`.

**What it does:**
- Triggers when you push a version tag like `v0.0.2`
- Runs `npm run build`
- Extracts release notes from `CHANGELOG.md`
- Creates a GitHub Release with the notes and uploads the ZIP as a release asset
- Opens or updates a PR against `super-productivity/super-productivity` bumping the `invoicer` release metadata (`version`, `downloadUrl`, `sha256`) in `src/assets/community-plugins.json`

The catalog PR is what enables the in-app **Community Plugins → Install/Update** button. The separate [awesome-super-productivity](https://github.com/super-productivity/awesome-super-productivity) list is generated from that same catalog file, so it does not need its own PR. The catalog ships with Super Productivity, so users see the new listing after the next app release that includes it.

**Catalog PR setup:**

Add a repository secret named `SP_COMMUNITY_PLUGIN_TOKEN` with a PAT that can create forks and push branches (a classic token with `public_repo` works). The workflow creates the token owner's fork of `super-productivity/super-productivity` if needed and opens the PR from there. Set the repository variable `SP_COMMUNITY_PLUGIN_FORK` to `owner/repo` to use a different fork. Without the secret, the release still publishes and the catalog PR step is skipped with a warning.

**How to publish a release:**

```bash
npm version patch  # or minor / major
git push origin main --follow-tags
```

GitHub Actions automatically creates the release with changelog notes and ZIP attachment.

**Notes:**
- `CHANGELOG.md` is automatically updated during `npm version` from commit history
- Tag format must be `v*.*.*` (e.g. `v1.2.3`)

## Versioning

Version numbers are automatically synced between `package.json` and `plugin/manifest.json` via an `npm version` lifecycle hook.

When you run `npm version patch` (or `minor`/`major`):
1. `package.json` version is updated
2. `plugin/manifest.json` is synced
3. `CHANGELOG.md` is updated from recent commits
4. A single git commit and version tag are created

## Pull Requests

Please feel free to submit a pull request. All contributions are welcome.
