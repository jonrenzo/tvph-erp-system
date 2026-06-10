-- ============================================================================
-- Associate email_log rows with a vendor for the per-vendor "Email History".
-- ref_id is polymorphic (po_id | document_id | vendor_id), so a dedicated
-- vendor_id column makes "all emails sent to vendor X" a single indexed query.
-- ============================================================================

alter table public.email_log
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

create index if not exists idx_email_log_vendor_created
  on public.email_log (vendor_id, created_at desc);

-- Backfill existing rows.
update public.email_log
  set vendor_id = ref_id
  where kind = 'doc_request' and vendor_id is null and ref_id is not null;

update public.email_log
  set vendor_id = (meta->>'vendor_id')::uuid
  where kind = 'doc_reminder' and vendor_id is null and (meta ? 'vendor_id');

update public.email_log e
  set vendor_id = po.vendor_id
  from public.purchase_orders po
  where e.kind = 'po_issued' and e.vendor_id is null and e.ref_id = po.id;
