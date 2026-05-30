-- ============================================================================
-- Purchase Order document pipeline (DOCX -> PDF snapshot artifacts)
-- ============================================================================

-- 1) Extend purchase_orders with fields used by PO templates
alter table public.purchase_orders
  add column if not exists prepared_date date,
  add column if not exists vendor_no text,
  add column if not exists incoterms text,
  add column if not exists terms_and_conditions text;

-- 2) Artifact records for generated PO files
create table if not exists public.purchase_order_artifacts (
  id                   uuid primary key default gen_random_uuid(),
  po_id                uuid not null references public.purchase_orders(id) on delete cascade,
  artifact_type        text not null check (artifact_type = any (array['draft_pdf', 'issued_pdf', 'docx'])),
  storage_bucket       text not null default 'po-artifacts',
  storage_path         text not null,
  file_url             text,
  content_type         text not null,
  file_size            bigint,
  checksum_sha256      text not null,
  template_document_id uuid references public.tvph_documents(id) on delete set null,
  template_name        text,
  template_version     text,
  generated_by         uuid references public.profiles(id),
  generated_at         timestamptz default now(),
  is_immutable         boolean not null default false
);

alter table public.purchase_order_artifacts enable row level security;

drop policy if exists "auth_access_purchase_order_artifacts" on public.purchase_order_artifacts;
create policy "auth_access_purchase_order_artifacts" on public.purchase_order_artifacts
  for all to authenticated using (true) with check (true);

-- One issued snapshot per PO (immutable official output)
create unique index if not exists idx_po_artifacts_one_issued_pdf
  on public.purchase_order_artifacts(po_id)
  where artifact_type = 'issued_pdf';

create index if not exists idx_po_artifacts_po_id_generated_at
  on public.purchase_order_artifacts(po_id, generated_at desc);

-- 3) Storage bucket for generated PO artifacts
insert into storage.buckets (id, name, public) values ('po-artifacts', 'po-artifacts', false)
  on conflict (id) do nothing;

drop policy if exists "Allow authenticated selects on po-artifacts" on storage.objects;
create policy "Allow authenticated selects on po-artifacts" on storage.objects
  for select to authenticated using (bucket_id = 'po-artifacts');

drop policy if exists "Allow authenticated uploads to po-artifacts" on storage.objects;
create policy "Allow authenticated uploads to po-artifacts" on storage.objects
  for insert to authenticated with check (bucket_id = 'po-artifacts');

drop policy if exists "Allow authenticated updates on po-artifacts" on storage.objects;
create policy "Allow authenticated updates on po-artifacts" on storage.objects
  for update to authenticated using (bucket_id = 'po-artifacts');

drop policy if exists "Allow authenticated deletes on po-artifacts" on storage.objects;
create policy "Allow authenticated deletes on po-artifacts" on storage.objects
  for delete to authenticated using (bucket_id = 'po-artifacts');
