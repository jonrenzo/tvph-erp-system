-- ============================================================================
-- Add 'gcash' and 'card' to the shared payment_method check constraint
-- ============================================================================
-- Both the UI and future service_invoices.payment_method reference these
-- values, so the underlying payments constraint must be kept in sync.

alter table public.payments
  drop constraint if exists payments_payment_method_check,
  add constraint payments_payment_method_check
    check (payment_method = any (array['cash', 'cheque', 'bank_transfer', 'gcash', 'card', 'others']));
