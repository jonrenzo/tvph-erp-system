-- ============================================================================
-- Add payment_method, submitted_at to service_invoices + extend email_log kind
-- ============================================================================

-- 1. payment_method on service_invoices — same values as the shared payments
--    constraint (see 20260702_payment_method_gcash.sql).
alter table public.service_invoices
  add column if not exists payment_method text
    check (payment_method = any (array['cash', 'cheque', 'bank_transfer', 'gcash', 'card', 'others']));

-- 2. submitted_at — tracks when the invoice was submitted/authorised, which
--    starts the Net-30 countdown (due_date = submitted_at + 30).
alter table public.service_invoices
  add column if not exists submitted_at timestamptz;

-- 3. Extend email_log kind check to accept the new reminder type.
alter table public.email_log
  drop constraint if exists email_log_kind_check,
  add constraint email_log_kind_check
    check (kind = any (array['po_issued', 'doc_reminder', 'doc_request', 'invoice_due_reminder']));
