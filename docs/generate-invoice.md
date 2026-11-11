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
5. **Set the file name** — Edit the **File Name Template** field (see [PDF File Name](#pdf-file-name)).
6. **Preview Invoice** — Click **Preview Invoice** to render the invoice inline (no inner scroll box). The **Download PDF** button appears at the top-right of the preview, showing the file name it will use.
7. **Download PDF** — Click **Download PDF** to save the invoice to your downloads folder. The PDF is text-based, so its text is selectable and searchable.

## PDF File Name

The **Generate Invoice** form has a **File Name Template** field. It is pre-filled from the selected client's profile and saved back to that profile when you generate, so your choice is remembered. It supports these placeholders:

| Placeholder | Value |
|-------------|-------|
| `{invoiceNumber}` | e.g. `INV-202610-00042` |
| `{clientName}` | Client name |
| `{clientShortName}` | Client short name (set it in the Clients tab) |
| `{businessName}` | Your business name |
| `{invoiceTitle}` | Invoice title (e.g. `Invoice`) |
| `{date}` | Invoice date (`YYYY-MM-DD`) |
| `{dueDate}` | Due date (`YYYY-MM-DD`) |
| `{period}` | Billing period label (e.g. `October 2026`) |

The default is `{invoiceNumber}-{clientName}`, which produces e.g. `INV-202610-00042-Acme-Corp.pdf`. A live example is shown under the field, and `.pdf` is added automatically.

Each client can have an optional **Short Name** (e.g. `TAIC`) for the `{clientShortName}` placeholder — useful when full client names are long.

Templates are validated strictly: an empty template, an unknown placeholder, a resolved name longer than 150 characters, or using `{clientShortName}` for a client with no short name is an error (shown in red under the field and as a notification), and the invoice is **not** generated — there is no silent fallback or truncation.

## Invoice Storage

When you download an invoice, the plugin stores metadata about it:
- Invoice number
- Invoice date
- Total amount
- Billing period

> The PDF itself is **not** stored in the plugin — save your PDFs externally. The metadata is kept for reference and syncs across devices.

## Tips

- Tasks with identical names are **automatically merged** into a single line item with combined hours.
- Set a **due date** in the invoice settings to have payment terms printed on the invoice.
