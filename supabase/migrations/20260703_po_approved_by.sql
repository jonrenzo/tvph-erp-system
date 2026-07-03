-- Track who approved the PO for 4-eyes workflow
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;
