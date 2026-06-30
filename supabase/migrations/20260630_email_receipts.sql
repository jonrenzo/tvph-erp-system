-- Email delivery/open/bounce receipt columns.
-- Populated by the Resend webhook at /api/resend/webhook.
-- All nullable: null means the event hasn't fired (or hasn't been received yet).
alter table public.email_log
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at    timestamptz,
  add column if not exists bounced_at   timestamptz;

-- Webhook updates are keyed by resend_id; no index existed.
create index if not exists idx_email_log_resend_id on public.email_log (resend_id);
