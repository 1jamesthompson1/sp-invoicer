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
