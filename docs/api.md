# API docs

## Internal route handlers

| Route | Purpose |
| --- | --- |
| `/api/chat` | Authenticated Gemini assistant stream. |
| `/api/audit-logs/recent` | Recent audit log entries. |
| `/api/client-pos` | Client PO endpoint. |
| `/api/crm/accounts` | CRM account endpoint. |
| `/api/export/crm` | CRM export. |
| `/api/export/projects` | Projects export. |
| `/api/export/purchase-orders` | Purchase orders export. |
| `/api/export/purchase-requests` | Purchase requests export. |
| `/api/export/vendors` | Vendors export. |
| `/api/hr/invite` | Admin user invite/create endpoint. |
| `/api/purchase-orders/[id]/edit-history` | PO edit history. |
| `/api/purchase-orders/[id]/email-log` | PO email log. |
| `/api/purchase-orders/[id]/pdf` | PO PDF rendering. |
| `/api/reports/ap-aging` | AP aging PDF report. |
| `/api/reports/compliance` | Compliance PDF report. |
| `/api/reports/operations` | Operations PDF report. |
| `/api/reports/vendor-register` | Vendor register PDF report. |
| `/api/system/logs` | System panel logs proxy. |
| `/api/vendors` | Partner vendor-list API. |
| `/api/vendors/[id]/email-log` | Vendor email log. |

## Webhooks and cron

| Route | Purpose | Protection |
| --- | --- | --- |
| `/api/cron/document-reminders` | Document expiry reminders. | `CRON_SECRET` bearer token |
| `/api/cron/invoice-due-reminders` | Invoice due reminders. | `CRON_SECRET` bearer token |
| `/api/cron/node-status` | twinbackend node-status sync. | `CRON_SECRET` bearer token |
| `/api/resend/webhook` | Resend delivery/open/bounce updates. | Svix signature |
| `/api/telegram/webhook` | Telegram role assignment. | Telegram webhook secret |

## Partner vendor API

See [PARTNER_VENDOR_API.md](PARTNER_VENDOR_API.md). Use placeholders in docs and secret storage in deployments. Do not commit real bearer tokens.

