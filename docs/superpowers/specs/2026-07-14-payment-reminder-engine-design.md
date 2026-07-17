# Payment Reminder Engine Design

## Goal

Implement issues #25, #26, and #27: structured per-PO payment/penalty terms, supplier invoice payment reminders, and vendor deliverable deadline reminders with informational penalties.

## Scope

- A PO represents one deliverable.
- `purchase_orders.due_date` is that deliverable's deadline.
- An approved 100% PO completion certificate, or PO cancellation, ends vendor deadline reminders.
- All schedule calculations use calendar dates in `Asia/Manila`.
- This rollout is prospective: legacy issued POs remain excluded until terms are explicitly saved in the new fields.

## Data model

`purchase_orders` gains:

- `net_days integer not null default 30 check (net_days > 0)`
- `dp_due_days integer check (dp_due_days >= 0)`
- `penalty_rate numeric(5,4) check (penalty_rate >= 0 and penalty_rate <= 1)`
- `penalty_type text check (penalty_type in ('monthly', 'fixed'))`
- `terms_configured_at timestamptz`

The UI accepts a decimal penalty rate: `0.1` means 10%. `dp_due_days` means calendar days after the PO issue date; it is stored and displayed only in this scope.

Create `po_penalties` with one row per PO. It records the current calculated amount, an optional manual override amount and required reason, calculation dates, and user/timestamps for the override. It does not alter invoice balances, payment requests, or accounting totals.

Extend `email_settings` with independent values:

- `invoice_due_reminder_days integer not null default 7`
- `vendor_deadline_warning_days integer[] not null default array[7, 5]`
- `vendor_overdue_repeat_days integer not null default 7`

Extend the `email_log.kind` constraint for invoice due-day and vendor deadline reminder events. Each successful send is deduplicated by kind, referenced record, and its milestone stored in `meta`.

New public tables receive RLS, least-privilege authenticated grants, and staff-only read/write policies matching the existing PO and settings authorization model. Add indexes supporting daily PO eligibility and penalty lookup.

## PO terms workflow

The create-PO form gets a Contract Terms section for all new fields. The creation action validates and persists them, sets `terms_configured_at`, and includes terms in the audit record.

Draft PO detail pages get a compact terms editor. Only users with `po.write` may save it, and only while the PO is in `draft`; every change is audited. Once a PO is submitted or issued, terms are immutable through this workflow.

The PO detail page also displays the current penalty. Finance/admin users can submit a manual peso override and a mandatory reason. The displayed informational penalty uses the override when present.

## Invoice payment-due workflow

Invoices may remain unlinked to POs. For an invoice linked to a PO, the server derives `due_date` from the Manila submission date plus `purchase_orders.net_days`; the form previews this value but cannot override it. Unlinked invoices retain the existing manual due date / Net-30 fallback.

`/api/cron/invoice-due-reminders` runs daily. It targets non-deleted invoices with statuses `received`, `under_review`, `approved`, or `partially_paid`.

- At the configured lead time, it emails active `finance`, `admin`, and `superadmin` profiles and creates an internal notification.
- On the due date, it repeats the internal email/notification using a separate milestone. If the PO has a linked project whose `completion_pct` is below 100, the due-day notification explicitly flags the project as incomplete.
- A failed email-log row does not suppress a later retry; only a successful milestone does.

## Vendor deliverable workflow

Add `/api/cron/vendor-deadline-reminders` and schedule it daily through the repository's existing `pg_cron` and `pg_net` pattern. It considers only prospective POs with confirmed terms, a due date, non-cancelled active PO status, and no approved 100% completion certificate.

- Send the primary `vendors.contact_email` a warning 7 and 5 calendar days before the deadline.
- Start the overdue workflow on the day after the deadline, then repeat every configured 7 days until resolved.
- Each warning/overdue event also creates an internal notification. Missing or invalid vendor email creates a failed email-log entry and leaves the internal notification visible.
- When overdue, calculate the informational penalty as `PO amount × penalty_rate × overdue_days ÷ 30`, rounded to centavos. A `fixed` penalty is `PO amount × penalty_rate`, applied once. Persist/update the PO penalty row unless a manual override is present.

## Architecture

Use two focused cron route handlers rather than a unified payment engine:

- retain and correct the invoice reminder route;
- add a vendor-deadline route;
- share only small date/recipient/penalty helpers where direct duplication would otherwise risk divergent business rules.

This preserves the repository's existing Cron-to-Next route structure, keeps invoice and vendor failures isolated, and avoids a speculative event queue.

## Verification

- Unit-test server due-date calculation, settings validation, penalty calculation, and manual overrides.
- Route tests cover milestones, recipient selection, project-incomplete due-day flags, completion/cancellation exclusion, and successful-only de-duplication.
- Check migration constraints, RLS/grants, indexes, and cron scheduling SQL.
- Run `npm run lint`, `npm run test`, and `npm run build` before release.
