-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================================
-- SEQUENCES
-- ============================================================================
create sequence if not exists public.po_number_seq start 1;

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. profiles
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  role          text not null check (role = any (array['admin', 'finance', 'procurement', 'project_manager'])),
  email         text not null,
  created_at    timestamptz default now(),
  avatar_url    text
);
alter table public.profiles enable row level security;

-- 2. vendors
create table if not exists public.vendors (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  address             text,
  tin                 text,
  contact_person      text,
  contact_email       text,
  contact_phone       text,
  bank_name           text,
  bank_account_number text,
  bank_account_name   text,
  payment_terms       text,
  status              text not null default 'pending' check (status = any (array['pending', 'active', 'inactive'])),
  notes               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  deleted_at          timestamptz,
  secondary_contacts  jsonb default '[]'::jsonb,
  secondary_banking   jsonb default '[]'::jsonb,
  currency            text not null default 'PHP' check (currency = any (array['PHP', 'USD']))
);
alter table public.vendors enable row level security;

-- 3. vendor_documents (14-point compliance)
create table if not exists public.vendor_documents (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors(id) on delete cascade,
  doc_type      text not null check (doc_type = any (array[
    'signed_nda', 'statement_of_commitment', 'company_profile',
    'products_services_list', 'vendor_information_summary',
    'general_information_sheet', 'audited_financial_statements',
    'sec_registration', 'secretary_certificate', 'safety_drug_policy',
    'iso_certification', 'pcab_license', 'dole_174', 'other_licenses'
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
alter table public.vendor_documents enable row level security;

-- 4. tvph_documents (company library)
create table if not exists public.tvph_documents (
  id          uuid primary key default gen_random_uuid(),
  doc_type    text not null,
  label       text,
  file_url    text,
  file_name   text,
  expiry_date date,
  uploaded_by uuid references public.profiles(id),
  notes       text,
  archived_at timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.tvph_documents enable row level security;

-- 5. projects
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  contract_url text,
  status       text default 'active',
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  deleted_at   timestamptz
);
alter table public.projects enable row level security;

-- 6. project_vendors (many-to-many)
create table if not exists public.project_vendors (
  project_id uuid not null references public.projects(id) on delete cascade,
  vendor_id  uuid not null references public.vendors(id) on delete cascade,
  linked_at  timestamptz default now(),
  primary key (project_id, vendor_id)
);
alter table public.project_vendors enable row level security;

-- 7. vendor_contracts
create table if not exists public.vendor_contracts (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors(id) on delete cascade,
  project_id      uuid references public.projects(id),
  contract_number text not null,
  title           text not null,
  start_date      date not null,
  end_date        date,
  total_value     numeric,
  file_url        text,
  file_name       text,
  status          text default 'active',
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.vendor_contracts enable row level security;

-- 8. purchase_orders
create table if not exists public.purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendors(id),
  po_number         text not null unique,
  description       text,
  amount            numeric not null,
  issued_date       date not null,
  due_date          date,
  status            text not null default 'draft' check (status = any (array['draft', 'issued', 'partially_paid', 'paid', 'overpaid', 'cancelled'])),
  created_by        uuid references public.profiles(id),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  deleted_at        timestamptz,
  project_id        uuid references public.projects(id),
  internal_entity_id uuid references public.internal_entities(id),
  currency          text not null default 'PHP' check (currency = any (array['PHP', 'USD']))
);
alter table public.purchase_orders enable row level security;

-- 9. service_invoices
create table if not exists public.service_invoices (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors(id),
  po_id          uuid references public.purchase_orders(id),
  invoice_number text not null,
  amount         numeric not null,
  invoice_date   date not null,
  due_date       date,
  status         text not null default 'received' check (status = any (array['received', 'under_review', 'approved', 'partially_paid', 'paid', 'disputed'])),
  file_url       text,
  file_name      text,
  notes          text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  deleted_at     timestamptz
);
alter table public.service_invoices enable row level security;

-- 10. payments
create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  invoice_id           uuid not null references public.service_invoices(id),
  amount_paid          numeric not null,
  payment_date         date not null,
  payment_type         text check (payment_type = any (array['full', 'installment', 'down_payment'])),
  reference_number     text,
  notes                text,
  overpayment_override boolean default false,
  overridden_by        uuid references public.profiles(id),
  recorded_by          uuid references public.profiles(id),
  created_at           timestamptz default now(),
  deleted_at           timestamptz,
  payment_method       text check (payment_method = any (array['cash', 'cheque', 'bank_transfer', 'others']))
);
alter table public.payments enable row level security;

-- 11. internal_entities
create table if not exists public.internal_entities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);
alter table public.internal_entities enable row level security;

-- 12. audit_logs
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,
  entity_id    uuid not null,
  action       text not null check (action = any (array['CREATE', 'UPDATE', 'DELETE'])),
  changes      jsonb,
  performed_by uuid references public.profiles(id),
  created_at   timestamptz default now()
);
alter table public.audit_logs enable row level security;

-- 13. notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,
  title      text not null,
  message    text not null,
  link       text,
  is_read    boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

create or replace function public.generate_po_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.po_number is null or NEW.po_number = '' then
    NEW.po_number := 'PO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.po_number_seq')::text, 4, '0');
  end if;
  return NEW;
end;
$$;

drop trigger if exists set_po_number on public.purchase_orders;
create trigger set_po_number
  before insert on public.purchase_orders
  for each row
  execute function public.generate_po_number();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- profiles
drop policy if exists "Allow authenticated full access" on public.profiles;
create policy "Allow authenticated full access" on public.profiles
  for all to authenticated using (true) with check (true);

-- vendors
drop policy if exists "auth_access_vendors" on public.vendors;
create policy "auth_access_vendors" on public.vendors
  for all to authenticated using (true) with check (true);

-- vendor_documents
drop policy if exists "auth_access_vendor_docs" on public.vendor_documents;
create policy "auth_access_vendor_docs" on public.vendor_documents
  for all to authenticated using (true) with check (true);

-- tvph_documents
drop policy if exists "Allow authenticated full access" on public.tvph_documents;
create policy "Allow authenticated full access" on public.tvph_documents
  for all to authenticated using (true) with check (true);
drop policy if exists "Allow authenticated select from tvph_documents" on public.tvph_documents;
create policy "Allow authenticated select from tvph_documents" on public.tvph_documents
  for select to authenticated using (true);
drop policy if exists "Allow authenticated inserts to tvph_documents" on public.tvph_documents;
create policy "Allow authenticated inserts to tvph_documents" on public.tvph_documents
  for insert to authenticated with check (true);
drop policy if exists "Allow authenticated updates to tvph_documents" on public.tvph_documents;
create policy "Allow authenticated updates to tvph_documents" on public.tvph_documents
  for update to authenticated using (true);

-- projects
drop policy if exists "Enable read access for authenticated users on projects" on public.projects;
create policy "Enable read access for authenticated users on projects" on public.projects
  for select to authenticated using (true);
drop policy if exists "Enable insert access for authenticated users on projects" on public.projects;
create policy "Enable insert access for authenticated users on projects" on public.projects
  for insert to authenticated with check (true);
drop policy if exists "Enable update access for authenticated users on projects" on public.projects;
create policy "Enable update access for authenticated users on projects" on public.projects
  for update to authenticated using (true) with check (true);
drop policy if exists "Enable delete access for authenticated users on projects" on public.projects;
create policy "Enable delete access for authenticated users on projects" on public.projects
  for delete to authenticated using (true);

-- project_vendors
drop policy if exists "Allow authenticated full access" on public.project_vendors;
create policy "Allow authenticated full access" on public.project_vendors
  for all to authenticated using (true) with check (true);

-- vendor_contracts
drop policy if exists "Enable all for authenticated users" on public.vendor_contracts;
create policy "Enable all for authenticated users" on public.vendor_contracts
  for all to authenticated using (true) with check (true);

-- purchase_orders
drop policy if exists "Allow authenticated full access" on public.purchase_orders;
create policy "Allow authenticated full access" on public.purchase_orders
  for all to authenticated using (true) with check (true);

-- service_invoices
drop policy if exists "Allow authenticated full access" on public.service_invoices;
create policy "Allow authenticated full access" on public.service_invoices
  for all to authenticated using (true) with check (true);

-- payments
drop policy if exists "Allow authenticated full access" on public.payments;
create policy "Allow authenticated full access" on public.payments
  for all to authenticated using (true) with check (true);

-- internal_entities
drop policy if exists "Allow authenticated full access" on public.internal_entities;
create policy "Allow authenticated full access" on public.internal_entities
  for all to authenticated using (true) with check (true);

-- audit_logs
drop policy if exists "auth_access_audit_logs" on public.audit_logs;
create policy "auth_access_audit_logs" on public.audit_logs
  for all to authenticated using (true) with check (true);

-- notifications
drop policy if exists "Authenticated users can read notifications" on public.notifications;
create policy "Authenticated users can read notifications" on public.notifications
  for select to public using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can mark notifications as read" on public.notifications;
create policy "Authenticated users can mark notifications as read" on public.notifications
  for update to public using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete notifications" on public.notifications;
create policy "Authenticated users can delete notifications" on public.notifications
  for delete to public using (auth.role() = 'authenticated');

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('vendor-documents', 'vendor-documents', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('tvph-documents', 'tvph-documents', false)
  on conflict (id) do nothing;

-- Storage policies
drop policy if exists "Avatar Public View" on storage.objects;
create policy "Avatar Public View" on storage.objects
  for select to public using (bucket_id = 'avatars');
drop policy if exists "Avatar Upload Policy" on storage.objects;
create policy "Avatar Upload Policy" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "Allow authenticated selects" on storage.objects;
create policy "Allow authenticated selects" on storage.objects
  for select to authenticated using (bucket_id = 'vendor-documents');
drop policy if exists "Allow authenticated uploads" on storage.objects;
create policy "Allow authenticated uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'vendor-documents');
drop policy if exists "Allow authenticated updates" on storage.objects;
create policy "Allow authenticated updates" on storage.objects
  for update to authenticated using (bucket_id = 'vendor-documents');

drop policy if exists "Allow public reading of tvph-documents" on storage.objects;
create policy "Allow public reading of tvph-documents" on storage.objects
  for select to public using (bucket_id = 'tvph-documents');
drop policy if exists "Allow authenticated uploads to tvph-documents" on storage.objects;
create policy "Allow authenticated uploads to tvph-documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'tvph-documents');
drop policy if exists "Allow authenticated deletes from tvph-documents" on storage.objects;
create policy "Allow authenticated deletes from tvph-documents" on storage.objects
  for delete to authenticated using (bucket_id = 'tvph-documents');
