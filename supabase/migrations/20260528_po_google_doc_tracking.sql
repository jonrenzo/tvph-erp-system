-- Add Google Doc tracking to PO artifacts
alter table public.purchase_order_artifacts
  add column if not exists google_doc_id text,
  add column if not exists google_doc_url text,
  add column if not exists google_doc_modified_at timestamptz,
  add column if not exists last_synced_at timestamptz;

-- Index for quickly finding the Google Doc artifact for a PO
create index if not exists idx_po_artifacts_google_doc
  on public.purchase_order_artifacts(po_id)
  where google_doc_id is not null;
