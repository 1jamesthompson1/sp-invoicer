# FAQ & Troubleshooting

## General

### How do I update the plugin?
Download the latest release ZIP and load it through Super Productivity's plugin manager. Your data (clients, project assignments, details) will be preserved.

### My data isn't syncing across devices
Make sure Super Productivity sync is enabled and configured. The plugin uses Super Productivity's built-in sync to store your details, clients, and project assignments.

### Why can't it do X or Y?
This is early-stage software. Please check out the [github issues page](https://github.com/1jamesthompson1/sp-invoicer/issues) to see if your feature request has been logged, or create a new issue to request it.

## Troubleshooting

In general, if you encounter a problem, please check the following and if nothing works, raise an issue on the [github issues page](https:github.com/1jamesthompson1/sp-invoicer/issues).

### No tracked time appears for my client
1. Check that your projects are assigned to the client in the **Projects** tab.
2. Make sure you tracked time in Super Productivity during the selected billing period.
3. Confirm the billing period covers the dates when time was tracked.

### The invoice total looks wrong
- Verify the **hourly rate** is set correctly for the selected client.
- Check that the **billing period** covers the expected dates.
- Review the **itemization level** — project totals may hide discrepancies in individual tasks.
- Check your rounding settings

### Changes to My Details aren't showing on invoices
Make sure you **save** your details after editing. If they still don't appear, try closing and re-opening the plugin.

## Limitations

- Project-to-client assignments are managed inside the plugin only (not from Super Productivity's project view).
- Invoice PDFs are not stored inside the plugin — remember to save them externally.
- This is early-stage software. Some features may be rough around the edges.
