-- Records which admins/superadmins the PO creator selected to approve a PO at
-- submit-for-approval time. This is NOTIFY-ONLY: it does not restrict who may
-- approve (any holder of the po.approve capability who isn't the submitter can
-- still approve). It drives the "PO pending approval" email sent to the chosen
-- approvers. Stored as a plain uuid[] (no FK — Postgres arrays can't reference)
-- and overwritten on each re-submit after a rejection.
alter table public.purchase_orders
  add column if not exists approval_requested_from uuid[] not null default '{}';
