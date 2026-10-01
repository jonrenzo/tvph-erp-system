# Database

## Source of truth

`supabase/migrations/` is the schema source of truth. Apply migrations in filename order.

The migrations are additive and include tables, RLS, storage buckets, policies, indexes, cron jobs, and feature-specific schema changes. There are currently 67 SQL migrations.

## Core tables

Important tables include:

- `profiles`
- `vendors`
- `vendor_documents`
- `vendor_document_files`
- `vendor_document_file_versions`
- `tvph_documents`
- `erp_documents`
- `customer_documents`
- `employee_documents`
- `projects`
- `project_vendors`
- `vendor_contracts`
- `purchase_requests`
- `pr_line_items`
- `pr_site_details`
- `purchase_orders`
- `service_invoices`
- `payments`
- `payment_requests`
- `payment_reservations`
- `completion_certificates`
- `crm_accounts`
- `crm_contacts`
- `client_pos`
- `client_invoices`
- `assets`
- `audit_logs`
- `notifications`
- `email_log`
- `chat_messages`
- `internal_entities`
- `node_status`
- `vendor_sync_state`

Use the migrations for exact column definitions.

## Storage buckets

Known buckets include:

- `avatars`
- `vendor-documents`
- `tvph-documents`
- `erp-documents`
- `customer-documents`
- `employee-documents`
- PO/payment-related buckets from later migrations

Storage contains business files. Back it up with the database.

## RLS

RLS is enabled on application tables. Keep policy changes in migrations. Do not rely on UI checks for data protection.

## Cron

The project uses Supabase `pg_cron` and `pg_net` migrations for scheduled jobs:

- Vendor document expiry reminders.
- Invoice due reminders.
- Project node-status sync.

These jobs call protected app routes with `CRON_SECRET`.

## Schema change rules

- Add migrations; do not edit applied migrations.
- Keep migrations idempotent where possible.
- Update [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) and relevant Docsify pages when schema or buckets change.
- Add a small migration test under `__tests__/supabase/` for risky SQL changes.

