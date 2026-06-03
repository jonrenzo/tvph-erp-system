-- Module: HR, Accounting, Assets 
-- 1. HR: Add fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_hired date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_status text DEFAULT 'active'
  CHECK (employment_status = ANY(ARRAY['active','probationary','on_leave','resigned','terminated']));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type text DEFAULT 'full_time'
  CHECK (employment_type = ANY(ARRAY['full_time','part_time','contractual','consultant']));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sss_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS philhealth_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pagibig_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tin text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_relationship text;

-- 2. HR: 201 File Vault
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null check (doc_type = ANY(ARRAY[
    'resume','transcript','nbi_clearance','police_clearance',
    'medical_certificate','drug_test','birth_certificate',
    'marriage_certificate','sss_id','philhealth_id','pagibig_id',
    'tin_card','id_photos','job_offer','employment_contract',
    'appointment_letter','nda','employee_handbook_ack',
    'performance_review','training_certificate','certification',
    'disciplinary_notice','bir_2316','resignation_letter',
    'clearance_form','certificate_of_employment','other'
  ])),
  file_url text,
  file_name text,
  notes text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.employee_documents enable row level security;

drop policy if exists "Allow authenticated full access to employee documents" on public.employee_documents;
create policy "Allow authenticated full access to employee documents" on public.employee_documents
  for all to authenticated using (true) with check (true);

-- 3. Accounting: Expense categories and Tax fields
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expense_category text
  CHECK (expense_category = ANY(ARRAY[
    'labor','materials','equipment','subcontractor',
    'transportation','utilities','professional_fees',
    'government_fees','office_admin','other'
  ]));

ALTER TABLE public.service_invoices ADD COLUMN IF NOT EXISTS vat_amount numeric DEFAULT 0;
ALTER TABLE public.service_invoices ADD COLUMN IF NOT EXISTS ewt_rate numeric DEFAULT 0;
ALTER TABLE public.service_invoices ADD COLUMN IF NOT EXISTS ewt_amount numeric DEFAULT 0;
ALTER TABLE public.service_invoices ADD COLUMN IF NOT EXISTS expense_category text
  CHECK (expense_category = ANY(ARRAY[
    'labor','materials','equipment','subcontractor',
    'transportation','utilities','professional_fees',
    'government_fees','office_admin','other'
  ]));

-- 4. Assets: Asset Categories
create table if not exists public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references public.asset_categories(id),
  created_at timestamptz default now()
);
alter table public.asset_categories enable row level security;

drop policy if exists "Allow authenticated full access to asset categories" on public.asset_categories;
create policy "Allow authenticated full access to asset categories" on public.asset_categories
  for all to authenticated using (true) with check (true);

-- Seed Categories
INSERT INTO public.asset_categories (name) VALUES 
  ('IT Equipment'),
  ('Vehicles'),
  ('Office Furniture'),
  ('Tools'),
  ('Telecom Equipment')
ON CONFLICT DO NOTHING;

-- 5. Assets: Assets table
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_tag text unique not null,
  name text not null,
  description text,
  category_id uuid references public.asset_categories(id),
  serial_number text,
  model text,
  manufacturer text,
  purchase_date date,
  purchase_cost numeric,
  warranty_expiry date,
  salvage_value numeric default 0,
  useful_life_years integer default 5,
  status text not null default 'in_storage'
    check (status = ANY(ARRAY['in_use','available','in_storage','in_repair','disposed','lost'])),
  assigned_to uuid references public.profiles(id),
  location text,
  plate_number text,
  vehicle_type text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.assets enable row level security;

drop policy if exists "Allow authenticated full access to assets" on public.assets;
create policy "Allow authenticated full access to assets" on public.assets
  for all to authenticated using (true) with check (true);

-- 6. Assets: Maintenance Logs
create table if not exists public.asset_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  maintenance_type text not null check (maintenance_type = ANY(ARRAY[
    'repair','preventive','inspection','upgrade','other'
  ])),
  description text,
  cost numeric default 0,
  performed_date date not null,
  performed_by text,
  vendor_id uuid references public.vendors(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
alter table public.asset_maintenance_logs enable row level security;

drop policy if exists "Allow authenticated full access to asset maintenance logs" on public.asset_maintenance_logs;
create policy "Allow authenticated full access to asset maintenance logs" on public.asset_maintenance_logs
  for all to authenticated using (true) with check (true);

-- 7. Storage Bucket for Employee 201 Files
insert into storage.buckets (id, name, public) values ('employee-documents', 'employee-documents', false)
  on conflict (id) do nothing;

drop policy if exists "Allow authenticated selects on employee docs" on storage.objects;
create policy "Allow authenticated selects on employee docs" on storage.objects
  for select to authenticated using (bucket_id = 'employee-documents');
drop policy if exists "Allow authenticated uploads on employee docs" on storage.objects;
create policy "Allow authenticated uploads on employee docs" on storage.objects
  for insert to authenticated with check (bucket_id = 'employee-documents');
drop policy if exists "Allow authenticated updates on employee docs" on storage.objects;
create policy "Allow authenticated updates on employee docs" on storage.objects
  for update to authenticated using (bucket_id = 'employee-documents');
drop policy if exists "Allow authenticated deletes on employee docs" on storage.objects;
create policy "Allow authenticated deletes on employee docs" on storage.objects
  for delete to authenticated using (bucket_id = 'employee-documents');
