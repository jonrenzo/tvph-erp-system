-- Add fields needed for DOCX-based PO generation
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS mobilization_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_date     DATE,
  ADD COLUMN IF NOT EXISTS pr_number         TEXT,
  ADD COLUMN IF NOT EXISTS requisitioner     TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address  TEXT,
  ADD COLUMN IF NOT EXISTS approved_by       TEXT[];
