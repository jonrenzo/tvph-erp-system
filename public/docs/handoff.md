# Turnover guide

## What is being turned over

TelcoVantage ERP is the internal operations system for TelcoVantage Philippines. It covers office workflows around vendors, procurement, accounts payable, accounts receivable, CRM, projects, HR records, assets, reports, and documents.

The system is not a generic ERP package. Several workflows encode TelcoVantage-specific rules, especially vendor accreditation, purchase request and purchase order approvals, payment requests, document reminders, and project node-status sync.

## Production owners should receive

- Repository access.
- Hosting access.
- Supabase project access.
- Supabase database and storage backup access.
- Resend account access.
- Google AI Studio or Google Cloud key access for Gemini.
- Telegram bot access if role-assignment notifications are used.
- Vercel token and Supabase management token if the System panel should show logs.
- Current production environment variable inventory.
- DNS records for email sending. See [godaddy-resend-dns-records.md](godaddy-resend-dns-records.md).

## First week checklist

1. Confirm users can sign in.
2. Confirm at least one `superadmin` account exists.
3. Confirm vendor, PO, invoice, CRM, and document pages load.
4. Send a test email from a non-critical workflow.
5. Run document reminder cron manually in a safe environment.
6. Confirm Supabase Storage buckets exist and uploads work.
7. Confirm backups and database access are documented outside the repo.
8. Run `npm run lint`, `npm run test`, and `npm run build` from a clean checkout.

## Business-critical workflows

| Workflow | Main route | Notes |
| --- | --- | --- |
| Vendor onboarding | `/dashboard/vendors` | Tracks vendor profile, status, contacts, bank data, and documents. |
| Vendor document collection | `/portal/upload/[token]` | Magic-link upload portal for external vendors. |
| Purchase requests | `/dashboard/purchase-requests` | Internal request workflow before PO conversion. |
| Purchase orders | `/dashboard/purchase-orders` | Approval, finance review, executive approval tiers, signatures, issue emails, PDF/DOCX. |
| Supplier invoices | `/dashboard/invoices` | Links AP invoices to POs and payment records. |
| Payment requests | `/dashboard/payment-requests` | Finance/ops request and approval flow. |
| CRM | `/dashboard/crm` | Customers, contacts, opportunities, documents. |
| Client POs and invoices | `/dashboard/client-pos`, `/dashboard/client-invoices` | AR side of the system. |
| Project status | `/dashboard/project-status` | Syncs node status from twinbackend. |
| Reports | `/dashboard/reports` | PDF reports from live data. |

## Do not lose

- `supabase/migrations/`: source of truth for schema and policies.
- `public/templates/PO_TEMPLATE_ORIGINAL.docx`: PO document template.
- `public/templates/po_original.pdf`: PDF reference/template asset.
- `public/fonts/`: PDF rendering fonts.
- Production environment values in secret storage.
- Supabase Storage files. They are business records, not disposable app cache.

## Known documentation locations

- Docsify source: `docs/`.
- Existing user guide served at `/docs`: `public/docs/index.html`.
- PDF user guide: `docs/user-guide/telcovantage-erp-user-guide.pdf`.
- API handoff docs: `docs/api_guide.md` and `docs/PARTNER_VENDOR_API.md`.
- Agent/project inventory: `docs/PROJECT_ANALYSIS.md`.

