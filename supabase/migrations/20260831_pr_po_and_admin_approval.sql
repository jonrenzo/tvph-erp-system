-- AND approval for admin stage (PR + PO): N-of-N where all IDs in approval_requested_from must approve

alter table public.purchase_requests
  add column if not exists admin_approved_by uuid[] not null default '{}',
  add column if not exists admin_approved_at timestamptz[] not null default '{}';

alter table public.purchase_orders
  add column if not exists admin_approved_by uuid[] not null default '{}',
  add column if not exists admin_approved_at timestamptz[] not null default '{}';

-- Exec tier columns (referenced in app code but missing in DB)
alter table public.purchase_orders
  add column if not exists exec_required_count integer not null default 0,
  add column if not exists exec_approved_by uuid[] not null default '{}',
  add column if not exists exec_approved_at timestamptz[] not null default '{}',
  add column if not exists exec_approval_requested_from uuid[] not null default '{}';

alter table public.purchase_requests
  add column if not exists exec_required_count integer not null default 0,
  add column if not exists exec_approved_by uuid[] not null default '{}',
  add column if not exists exec_approved_at timestamptz[] not null default '{}',
  add column if not exists exec_approval_requested_from uuid[] not null default '{}';

-- Status checks: add pending_exec_approval
alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
alter table public.purchase_orders add constraint purchase_orders_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_exec_approval', 'pending_finance',
    'issued', 'pending_signature', 'signed_received', 'signed',
    'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));

alter table public.purchase_requests drop constraint if exists purchase_requests_status_check;
alter table public.purchase_requests add constraint purchase_requests_status_check
  check (status = any (array[
    'draft', 'pending_approval', 'pending_exec_approval', 'pending_finance',
    'approved', 'rejected', 'converted', 'cancelled'
  ]));

-- Backfill single-admin history into array for existing rows
update public.purchase_requests
set admin_approved_by = array[approved_by_user_id],
    admin_approved_at = array[approved_at]
where approved_by_user_id is not null
  and admin_approved_by = '{}';

update public.purchase_orders
set admin_approved_by = array[approved_by_user_id],
    admin_approved_at = array[approved_at]
where approved_by_user_id is not null
  and admin_approved_by = '{}';

-- Email log kinds (include all existing kinds plus new ones)
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'po_pending_exec', 'po_pending_finance',
  'po_for_signature', 'po_signed_acknowledged', 'po_signed_received',
  'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder', 'payment_request_notification',
  'pr_pending_approval', 'pr_pending_finance', 'pr_approved'
]));
