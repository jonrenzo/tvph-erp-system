-- PO approval workflow: add pending_approval status + rejection tracking

-- Expand the status check constraint
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'pending_approval', 'issued',
    'partially_paid', 'paid', 'overpaid', 'cancelled'
  ]));

-- Approval workflow columns
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_for_approval_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS submitted_for_approval_at timestamptz;
