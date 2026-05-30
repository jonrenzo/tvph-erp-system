-- ============================================================================
-- CRM Document Versions
-- Every file upload creates a version row so history is never lost.
-- crm_documents keeps denormalized file_url/file_name of the current version
-- for fast reads.
-- ============================================================================

-- 1) crm_document_versions table
create table if not exists public.crm_document_versions (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid not null references public.crm_documents(id) on delete cascade,
  version_number  integer not null,
  file_url        text not null,
  file_name       text not null,
  file_size       bigint,
  file_type       text,
  uploaded_by     uuid references public.profiles(id),
  notes           text,
  created_at      timestamptz default now(),
  unique (document_id, version_number)
);

alter table public.crm_document_versions enable row level security;

-- 2) RLS
drop policy if exists "auth_access_crm_document_versions" on public.crm_document_versions;
create policy "auth_access_crm_document_versions" on public.crm_document_versions
  for all to authenticated using (true) with check (true);

-- 3) Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.crm_document_versions to authenticated;

-- 4) Indexes
create index if not exists idx_crm_doc_versions_doc_id_version
  on public.crm_document_versions(document_id, version_number desc);

-- 5) Add version_number and current_version_id to crm_documents
alter table public.crm_documents
  add column if not exists version_number integer not null default 0;

alter table public.crm_documents
  add column if not exists current_version_id uuid
  references public.crm_document_versions(id) on delete set null;

-- 6) Backfill: existing file attachments become version 1
insert into public.crm_document_versions (document_id, version_number, file_url, file_name, uploaded_by, created_at)
  select id, 1, file_url, file_name, uploaded_by, coalesce(submitted_at, created_at)
  from public.crm_documents
  where file_url is not null
    and archived_at is null
    and file_url != '';

-- 7) Set current_version_id and version_number on backfilled rows
update public.crm_documents d
  set
    current_version_id = v.id,
    version_number = 1
  from public.crm_document_versions v
  where v.document_id = d.id
    and v.version_number = 1;
