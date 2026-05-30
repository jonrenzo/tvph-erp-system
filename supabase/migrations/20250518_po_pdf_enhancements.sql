-- ============================================================================
-- PO PDF enhancements: downpayment amount & agreement ref no
-- ============================================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS dp_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreement_ref_no TEXT;
