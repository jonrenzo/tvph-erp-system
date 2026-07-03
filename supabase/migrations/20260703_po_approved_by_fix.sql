-- Fix approved_by column type conflict:
--   approved_by TEXT[] was created by 20250522_po_docx_fields.sql (for DOCX template)
--   20260703_po_approved_by.sql tried to add approved_by uuid but was silently skipped
--   because IF NOT EXISTS saw the column already existed (as TEXT[]).
--
-- This migration adds a dedicated uuid column for system-level approver tracking
-- and backfills it from any data already stored in the TEXT[] column.

-- Add proper uuid column for system-level approver tracking
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES auth.users(id);

-- Backfill existing approved POs from the TEXT[] approved_by column.
-- Previously, approvePO() stored user.id (a string/uuid) into the TEXT[] column.
-- PostgreSQL stored that as a single-element array, e.g. {uuid-string}.
-- Extract the first element and cast to uuid for eligible rows.
UPDATE public.purchase_orders
  SET approved_by_user_id = approved_by[1]::uuid
  WHERE status IN ('issued', 'partially_paid', 'paid', 'overpaid')
    AND approved_by IS NOT NULL
    AND array_length(approved_by, 1) > 0
    AND approved_by_user_id IS NULL;
