-- ============================================================================
-- ERP documents & comments tables for Plate rich-text editor
-- ============================================================================

-- 1. erp_documents
create table if not exists public.erp_documents (
  id               uuid primary key default gen_random_uuid(),
  title            text not null default 'Untitled Document',
  description      text,
  module           text not null check (module = any (array['purchase_order', 'project', 'standalone', 'crm', 'compliance', 'vendor'])),
  module_record_id uuid,
  status           text not null default 'draft' check (status = any (array['draft', 'review', 'issued', 'archived'])),
  content          jsonb not null default '[]'::jsonb,
  source_type      text check (source_type = any (array['docx_template', 'blank', 'imported'])),
  source_docx_path text,
  created_by       uuid references public.profiles(id) on delete set null,
  updated_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.erp_documents enable row level security;

drop policy if exists "auth_access_erp_documents" on public.erp_documents;
create policy "auth_access_erp_documents" on public.erp_documents
  for all to authenticated using (true) with check (true);

create index if not exists idx_erp_documents_module ON public.erp_documents(module, module_record_id);
create index if not exists idx_erp_documents_status ON public.erp_documents(status);

-- 2. erp_document_comments
create table if not exists public.erp_document_comments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.erp_documents(id) on delete cascade,
  content     jsonb not null,
  parent_id   uuid references public.erp_document_comments(id) on delete cascade,
  is_resolved boolean default false,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.erp_document_comments enable row level security;

drop policy if exists "auth_access_erp_document_comments" on public.erp_document_comments;
create policy "auth_access_erp_document_comments" on public.erp_document_comments
  for all to authenticated using (true) with check (true);

create index if not exists idx_doc_comments_document ON public.erp_document_comments(document_id);
create index if not exists idx_doc_comments_parent ON public.erp_document_comments(parent_id);

-- 3. erp_document_versions
create table if not exists public.erp_document_versions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.erp_documents(id) on delete cascade,
  version_number integer not null,
  content        jsonb not null,
  change_summary text,
  created_by     uuid not null references public.profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (document_id, version_number)
);

alter table public.erp_document_versions enable row level security;

drop policy if exists "auth_access_erp_document_versions" on public.erp_document_versions;
create policy "auth_access_erp_document_versions" on public.erp_document_versions
  for all to authenticated using (true) with check (true);

create index if not exists idx_doc_versions_document ON public.erp_document_versions(document_id);

-- 4. collab_documents
create table if not exists public.collab_documents (
  document_name text primary key,
  data          text not null, -- Stores Yjs binary state as Base64 encoded string
  updated_at    timestamptz default now()
);

alter table public.collab_documents enable row level security;

drop policy if exists "auth_access_collab_documents" on public.collab_documents;
create policy "auth_access_collab_documents" on public.collab_documents
  for all to authenticated using (true) with check (true);
