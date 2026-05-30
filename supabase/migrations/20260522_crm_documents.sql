-- ============================================================================
-- CRM Documents
-- Official Receipt, Specimen Signature, Valid ID per customer account
-- ============================================================================

-- 1) crm_documents table
create table if not exists public.crm_documents (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.crm_accounts(id) on delete cascade,
  doc_type      text not null check (doc_type = any (array[
    'official_receipt', 'specimen_signature', 'valid_id'
  ])),
  file_url      text,
  file_name     text,
  status        text not null default 'not_submitted' check (status = any (array['not_submitted', 'submitted', 'approved', 'expired'])),
  expiry_date   date,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  uploaded_by   uuid references public.profiles(id),
  notes         text,
  archived_at   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table public.crm_documents enable row level security;

-- Unique constraint for upsert (supports ON CONFLICT in Supabase JS client)
alter table public.crm_documents drop constraint if exists crm_documents_account_doc_type_key;
alter table public.crm_documents add constraint crm_documents_account_doc_type_key
  unique (account_id, doc_type);

-- 2) RLS policies
drop policy if exists "auth_access_crm_documents" on public.crm_documents;
create policy "auth_access_crm_documents" on public.crm_documents
  for all to authenticated using (true) with check (true);

-- 3) Storage bucket for CRM documents
insert into storage.buckets (id, name, public) values ('crm-documents', 'crm-documents', false)
  on conflict (id) do nothing;

drop policy if exists "Allow authenticated selects on crm-documents" on storage.objects;
create policy "Allow authenticated selects on crm-documents" on storage.objects
  for select to authenticated using (bucket_id = 'crm-documents');

drop policy if exists "Allow authenticated uploads to crm-documents" on storage.objects;
create policy "Allow authenticated uploads to crm-documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'crm-documents');

drop policy if exists "Allow authenticated updates on crm-documents" on storage.objects;
create policy "Allow authenticated updates on crm-documents" on storage.objects
  for update to authenticated using (bucket_id = 'crm-documents');

drop policy if exists "Allow authenticated deletes on crm-documents" on storage.objects;
create policy "Allow authenticated deletes on crm-documents" on storage.objects
  for delete to authenticated using (bucket_id = 'crm-documents');

-- 4) Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.crm_documents to authenticated;

-- 5) Indexes
create index if not exists idx_crm_documents_account_id
  on public.crm_documents(account_id);

create index if not exists idx_crm_documents_status
  on public.crm_documents(status)
  where archived_at is null;
