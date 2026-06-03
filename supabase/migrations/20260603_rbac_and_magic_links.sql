-- ============================================================================
-- Phase 1: DB Schema for Strict RBAC, Magic Links, and DMS Enhancements
-- ============================================================================

-- 1. Add project_manager_id to projects
alter table public.projects 
  add column if not exists project_manager_id uuid references public.profiles(id);

-- 2. Create magic_links table for external portal uploads
create table if not exists public.magic_links (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  entity_type text not null check (entity_type = any (array['vendor', 'customer'])),
  entity_id   uuid not null,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

alter table public.magic_links enable row level security;

-- Magic links can be read by public (for portal authentication) but only created/deleted by authenticated staff
drop policy if exists "magic_links_public_read" on public.magic_links;
create policy "magic_links_public_read" on public.magic_links
  for select to public using (expires_at > now());

drop policy if exists "magic_links_staff_all" on public.magic_links;
create policy "magic_links_staff_all" on public.magic_links
  for all to authenticated using (true) with check (true);

-- 3. Document Taxonomy and Versioning Enhancements
create table if not exists public.document_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz default now()
);

insert into public.document_categories (name, description) values
  ('Legal', 'Contracts, NDAs, and corporate compliance docs'),
  ('Financial', 'Invoices, receipts, and tax records'),
  ('Technical', 'PCAB, ISO, engineering tracks, and project scopes'),
  ('Administrative', 'Permits, forms, and general operations')
on conflict (name) do nothing;

-- Add category_id and ocr_data to erp_documents
alter table public.erp_documents
  add column if not exists category_id uuid references public.document_categories(id),
  add column if not exists ocr_data jsonb default '{}'::jsonb,
  add column if not exists version_number integer not null default 1;

-- ============================================================================
-- STRICT ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Helper function to check if user is admin
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role = 'admin';
end;
$$ language plpgsql security definer;

-- Helper function to check if user is staff (admin, finance, procurement, commercial_manager)
create or replace function public.is_staff(user_id uuid)
returns boolean as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role in ('admin', 'finance', 'procurement', 'commercial_manager');
end;
$$ language plpgsql security definer;

-- Helper function to check if user is a PM assigned to the project
create or replace function public.is_pm_assigned_to_project(user_id uuid, proj_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.projects 
    where id = proj_id 
    and (project_manager_id = user_id or created_by = user_id)
  );
end;
$$ language plpgsql security definer;

-- --- RECREATE RLS POLICIES FOR PROJECTS ---
drop policy if exists "Enable read access for authenticated users on projects" on public.projects;
create policy "projects_read_policy" on public.projects
  for select to authenticated
  using (
    public.is_staff(auth.uid()) or 
    project_manager_id = auth.uid() or 
    created_by = auth.uid()
  );

drop policy if exists "Enable update access for authenticated users on projects" on public.projects;
create policy "projects_update_policy" on public.projects
  for update to authenticated
  using (
    public.is_staff(auth.uid()) or 
    project_manager_id = auth.uid() or 
    created_by = auth.uid()
  )
  with check (
    public.is_staff(auth.uid()) or 
    project_manager_id = auth.uid() or 
    created_by = auth.uid()
  );

-- --- RECREATE RLS POLICIES FOR VENDORS ---
drop policy if exists "auth_access_vendors" on public.vendors;
create policy "vendors_read_policy" on public.vendors
  for select to authenticated
  using (
    public.is_staff(auth.uid()) or
    exists (
      select 1 from public.project_vendors pv
      join public.projects p on p.id = pv.project_id
      where pv.vendor_id = vendors.id
      and (p.project_manager_id = auth.uid() or p.created_by = auth.uid())
    )
  );

create policy "vendors_write_policy" on public.vendors
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- --- RECREATE RLS POLICIES FOR PURCHASE ORDERS ---
drop policy if exists "Allow authenticated full access" on public.purchase_orders;
create policy "po_read_policy" on public.purchase_orders
  for select to authenticated
  using (
    public.is_staff(auth.uid()) or
    public.is_pm_assigned_to_project(auth.uid(), project_id)
  );

create policy "po_write_policy" on public.purchase_orders
  for all to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Grant Permissions
grant select, insert, update, delete on table public.magic_links to authenticated, anon;
grant select, insert, update on table public.document_categories to authenticated;
grant select on table public.document_categories to anon;
