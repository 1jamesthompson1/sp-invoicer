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
- Export invoices as PDF
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

This creates a version commit + tag, then GitHub Actions builds and publishes the release.

## License

MIT
