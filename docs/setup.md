# Setup

## My Details

Open the plugin and go to **My Details** to set up your business information. This data appears on every invoice you generate.

### Fields

Fields you can fill in:
- **Name / Business Name** — Your name or company name
- **Email, Phone, Address** — Contact details
- **Tax ID Label + Tax ID** — e.g. "Business Number" / "GB123456789"
- **Tax Name / Rate** — Optional. e.g. "VAT 20%" or "Sales Tax 8.5%"
- **Bank / Payment Details** — Account name, sort code, account number, etc.
- **Invoice Title** — Optional custom title (defaults to "Invoice")
- **Closing Message** — Optional message at the bottom of invoices (e.g. "Thank you for your business")

> Save your details before generating invoices. Your information will sync across devices if you use Super Productivity's sync feature.

### User details profiles

You can create multiple user details profiles (e.g. freelancing work, self employed work, business work) and assign them to different clients. This allows you to have different tax settings, bank details, and invoice titles for different clients.

### Invoice numbering

Each profile has a default invoice number template and starting number. The built-in default is:

```
INV-{YYYY}{MM}-{monthNumber:3}
```

This produces `INV-202611-001`, `INV-202611-002`, and so on, then resets to `001` for the next month.

The template can contain fixed text and these placeholders:

| Placeholder | Value |
|-------------|-------|
| `{number}` | Running total across all saved invoices |
| `{yearNumber}` | Running total for the invoice's year |
| `{monthNumber}` | Running total for the invoice's month |
| `{random}` | Random digits (5 by default, e.g. `{random:8}`) |
| `{year}`, `{YYYY}` | Invoice year (`2026`) |
| `{YY}` | Two-digit invoice year (`26`) |
| `{month}`, `{MM}` | Two-digit invoice month (`11`) |
| `{day}`, `{DD}` | Two-digit invoice day (`19`) |

Add `:N` to a counter to pad it with zeros. For example, `{number:5}` produces `00042`.

**Number starts at** sets the first value used in each new counter period. Leave it at `1` for normal sequencing, or raise it to continue from invoices created in another system.

> Numbering is checked against saved invoices, so previewing an invoice does not use up a number. The number is stored when the invoice is saved by printing or downloading the PDF.

## Clients

Go to **Clients** and add at least one client. Each invoice is generated for a single client.

For each client you can set:
- **Client Name** — Required
- **Short Name** — Optional abbreviation (e.g. `TAIC`), usable in the invoice file name via `{clientShortName}`
- **Contact Details** — Email, phone, address (optional)
- **Hourly Rate** — Required. The rate used when calculating invoice totals.
- **User details profile** — Select which of your user details profiles to use for this client.
- **Invoice numbering overrides** — Optional invoice number template and starting number. Leave blank to use the selected profile's settings.

> Clients are stored in the plugin and synced across your devices.

## Projects

Go to **Projects** to assign your Super Productivity projects to clients.

- A project can be assigned to **one client only**.
- Invoice generation uses these assignments to determine which tracked time belongs to which client.
- Only time tracked under assigned projects will appear in the invoice.