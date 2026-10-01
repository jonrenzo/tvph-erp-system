# Modules

## Dashboard

Route: `/dashboard`

The command center shows KPIs, cash flow, active PO count, vendor/document attention items, project progress, compliance health, notifications, and recent activity.

## Vendors and accreditation

Routes:

- `/dashboard/vendors`
- `/dashboard/vendors/[id]`
- `/dashboard/vendors/contracts`
- `/portal/upload/[token]`

The vendor module manages company details, contacts, bank details, status, accreditation documents, document requests, email history, vendor-project links, contracts, and external upload portals.

The 14-point accreditation list is defined in `lib/vendors/document-types.ts`.

## Purchase requests

Routes:

- `/dashboard/purchase-requests`
- `/dashboard/purchase-requests/new`
- `/dashboard/purchase-requests/[id]`
- `/dashboard/purchase-requests/[id]/edit`

Purchase requests capture internal buying intent before PO creation. PRs include line items, site details, optional nominated vendor, down payment amount or percent, approvals, finance review, cancellation, and conversion to purchase orders.

## Purchase orders

Routes:

- `/dashboard/purchase-orders`
- `/dashboard/purchase-orders/new`
- `/dashboard/purchase-orders/import`
- `/dashboard/purchase-orders/[id]`
- `/dashboard/purchase-orders/[id]/editor`
- `/dashboard/purchase-orders/[id]/payment-request`
- `/portal/po/[token]`

POs include line items, site details, due dates, down payments, payment terms, compliance gates, approval workflows, finance review, executive approval tiers, signed PO review, completion certificates, email logs, edit history, PDF/DOCX output, and payment request creation.

Current executive approval rule:

| Amount | Approval |
| --- | --- |
| Up to 500,000 | Admin and finance flow. |
| 500,001 to 1,000,000 | CTO or CEO, one of two. |
| 1,000,001 and above | CTO and CEO, both required. |

## Supplier invoices and payments

Routes:

- `/dashboard/invoices`
- `/dashboard/invoices/new`
- `/dashboard/invoices/[id]`

Invoices link to vendor POs and enforce amount guards. Payment records support partial and full payment, voucher/proof files, due-date reminders, and status updates.

## Accounting and payment requests

Routes:

- `/dashboard/accounting`
- `/dashboard/payment-requests`

Accounting shows AP, payment reservations, payment requests, AP aging, and expense charts. Payment request capabilities are split across creation, approval, notification, and acknowledgement.

## CRM, client POs, and client invoices

Routes:

- `/dashboard/crm`
- `/dashboard/client-pos`
- `/dashboard/client-invoices`

CRM manages customer accounts, contacts, documents, opportunities, and projects. Client POs and client invoices cover the customer-side AR workflow, including import screens and payment tracking.

## Projects and project status

Routes:

- `/dashboard/projects`
- `/dashboard/project-status`

Projects link customers, vendors, contracts, purchase orders, progress, and activity. Project status syncs node data from twinbackend and stores rollups for project-linked vendors.

## Documents

Route: `/dashboard/documents`

The document center has company, vendor, and customer document areas. Versioning and previews are supported where the browser or linked viewer can display the file.

## HR

Route: `/dashboard/hr`

HR stores employee profiles and the 201 File Vault. The vault uses Supabase Storage.

## Assets

Route: `/dashboard/assets`

Assets track purchase data, assignment, status, value, and maintenance logs.

## Reports

Route: `/dashboard/reports`

Reports generate PDF output for operations, AP aging, compliance, and vendor registers. Shared calculations live in `lib/reports/`.

## System and settings

Routes:

- `/dashboard/system`
- `/dashboard/settings`
- `/dashboard/profile`
- `/dashboard/audit-logs`
- `/dashboard/notifications`

Settings includes team/RBAC and appearance. System includes health, storage, version, logs, and quotas. Audit logs and notifications are separate dashboard areas.

