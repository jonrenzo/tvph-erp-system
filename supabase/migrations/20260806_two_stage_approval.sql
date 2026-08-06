-- Two-stage approval flow for PRs and POs: admin stage then finance stage.
--   PR: draft -> pending_approval (admin) -> pending_finance (finance) -> approved -> converted
--   PO: draft -> pending_approval (admin) -> pending_finance (finance) -> issued
-- Rejection at either stage returns the document to draft.
-- approved_by_user_id/approved_at continue to record the ADMIN-stage approver;
-- the finance-stage approver is tracked in new finance_approved_by_* columns.

alter table public.purchase_requests
  drop constraint if exists purchase_requests_status_check;

alter table public.purchase_requests
  add constraint purchase_requests_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_finance', 'approved',
    'rejected', 'converted', 'cancelled'
  ]));

alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_finance', 'issued',
    'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));

-- Finance-stage approver tracking.
alter table public.purchase_requests
  add column if not exists finance_approved_by_user_id uuid references auth.users(id),
  add column if not exists finance_approved_at timestamptz;

alter table public.purchase_orders
  add column if not exists finance_approved_by_user_id uuid references auth.users(id),
  add column if not exists finance_approved_at timestamptz;

-- In-flight PRs that already passed the admin stage now await finance approval
-- before they can be converted to a PO.
update public.purchase_requests
set status = 'pending_finance', updated_at = now()
where status = 'approved';

-- email_log kinds for the finance-notification templates.
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'payment_request_notification',
  'pr_pending_approval', 'pr_approved', 'po_pending_finance', 'pr_pending_finance'
]));
