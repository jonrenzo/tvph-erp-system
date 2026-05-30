-- ============================================================================
-- CRM Documents — Add label column + support for custom typed documents
-- Allows users to upload ad-hoc documents with a free-text label.
-- ============================================================================

-- 1) Add label column (nullable — fixed types use doc_type as display name)
alter table public.crm_documents
  add column if not exists label text;

-- 2) Extend doc_type check to include 'custom'
alter table public.crm_documents
  drop constraint if exists crm_documents_doc_type_check;

alter table public.crm_documents
  add constraint crm_documents_doc_type_check
  check (doc_type = any (array[
    'official_receipt', 'specimen_signature', 'valid_id', 'custom'
  ]));

-- 3) Drop the old full-unique constraint; fixed types keep uniqueness
--    via a partial unique index. Custom docs may have multiple rows
--    per account.
alter table public.crm_documents
  drop constraint if exists crm_documents_account_doc_type_key;

create unique index if not exists idx_crm_documents_fixed_type_unique
  on public.crm_documents(account_id, doc_type)
  where doc_type != 'custom';
