<p align="center">
  <img src="docs/logo.svg" alt="SP Invoicer logo" width="128" height="128">
</p>

# Invoice maker plugin for Super Productivity

[![Latest release](https://img.shields.io/github/v/release/1jamesthompson1/sp-invoicer)](https://github.com/1jamesthompson1/sp-invoicer/releases/latest)
[![Docs](https://img.shields.io/badge/docs-user%20guide-blue)](https://1jamesthompson1.github.io/sp-invoicer)

> **⚠️ Early Development** — Core invoicing works, but some features and polish are still in progress.

Generate professional client invoices from your tracked time in [Super Productivity](https://super-productivity.com/).

## Features

- Generate client invoices from tracked time
- Assign projects to clients with custom hourly rates and tax settings
- Flexible billing periods: week, month, year, custom date range
- Three itemization levels: project totals, main task breakdown, nested subtask hierarchy
- Tasks with identical names are automatically merged
- Template-based invoice numbers with per-profile and per-client schemes (month/year/global counters or random)
- Dashboard of unbilled time and estimated value for the current week and month, broken down by client
- Download invoices as PDF — automatically named per invoice and client
- Store invoice metadata (number, date, total, period) for reference
- Sync invoice details, client data, and project assignments across devices

## Quick links

- [📖 Full documentation](https://sp-invoicer.sjhl.nz) — install, setup, and usage guide
- [⬇️ Latest release](https://github.com/1jamesthompson1/sp-invoicer/releases/latest) — download the plugin ZIP
- [🐛 Issues](https://github.com/1jamesthompson1/sp-invoicer/issues) — report bugs or request features

## Project setup

```bash
git clone https://github.com/1jamesthompson1/sp-invoicer.git
cd sp-invoicer
npm install
npm run build
```

## Releasing

```bash
npm version patch  # or minor / major
git push origin main --follow-tags
```

This creates a version commit + tag. GitHub Actions then:

- Builds the plugin ZIP and publishes the GitHub release.
- Opens or updates a PR against [`super-productivity/super-productivity`](https://github.com/super-productivity/super-productivity) bumping the `invoicer` entry in `src/assets/community-plugins.json` with the new `version`, `downloadUrl`, and `sha256`. That file powers the in-app **Community Plugins → Install/Update** buttons.
- The [awesome-super-productivity](https://github.com/super-productivity/awesome-super-productivity) list is generated from that catalog file, so no separate PR to the awesome list is needed.

The catalog ships inside Super Productivity, so the new Install/Update entry reaches users with the next app release that includes the merged listing.

To enable the catalog PR, add a repository secret named `SP_COMMUNITY_PLUGIN_TOKEN`:

- A classic PAT with `public_repo`, or a fine-grained token that can create forks and push branches.
- The token owner’s fork `<owner>/super-productivity` is created automatically if missing. To use a different fork, set the repository variable `SP_COMMUNITY_PLUGIN_FORK` to `owner/repo`.

If the secret is not set, the release still publishes and the catalog PR step is skipped with a workflow warning.

## License

MIT
