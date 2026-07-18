# Generate Invoice

Once you've set up your details, clients, and project assignments, you're ready to generate invoices.

Navigate to the **Generate Invoice** tab in the plugin.

## Steps

1. **Select a client** — Choose the client you want to invoice.
2. **Set invoice date** — The date printed on the invoice.
3. **Choose a billing period** — Select the time range to bill for:
   - **Period type** — Choose from Weekly, Fortnightly, Monthly, Yearly, Last N Days, or Custom Range
   - **Period** — Select the specific period instance (e.g., a particular ISO week, calendar month, or year)
   - **Weekly** periods use **ISO weeks** (Monday to Sunday) with the ISO week number
   - **Monthly/Yearly** periods use **calendar months/years**
   - **Last N days** — Specify a number of days to go back
   - **Custom Range** — Pick any start and end date
4. **Choose itemization level** — How detailed should the invoice be?
   - **Project totals only** — One line per project
   - **Main task breakdown** — Line items per top-level task
   - **Nested hierarchy** — Full parent/subtask tree
5. **Generate preview** — Review the invoice before finalising.
6. **Print / Save as PDF** — Use your browser's print dialog to save as PDF.

## Invoice Storage

When you print or save an invoice, the plugin stores metadata about it:
- Invoice number
- Invoice date
- Total amount
- Billing period

> The PDF itself is **not** stored in the plugin — save your PDFs externally. The metadata is kept for reference and syncs across devices.

## Tips

- Tasks with identical names are **automatically merged** into a single line item with combined hours.
- Set a **due date** in the invoice settings to have payment terms printed on the invoice.
