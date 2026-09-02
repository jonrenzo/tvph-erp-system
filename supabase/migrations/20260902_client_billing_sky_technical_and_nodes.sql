-- 1. Rename for_approval → pending_sky_technical in client_billing
-- Drop old check, migrate data, add new check.
alter table public.client_billing drop constraint if exists client_billing_status_check;
update public.client_billing set status = 'pending_sky_technical' where status = 'for_approval';
alter table public.client_billing add constraint client_billing_status_check
  check (status in ('for_billing','pending_sky_technical','for_payment','pending_payment','collected'));

-- 2. client_billing_nodes — mirrors pr_site_details shape + has_mrs flag
create table if not exists public.client_billing_nodes (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.client_billing(id) on delete cascade,
  sn integer not null,
  region text,
  area_city text,
  node_id text,
  phase text,
  no_of_nodes integer not null default 1,
  cable_length_km numeric not null default 0,
  has_mrs boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_client_billing_nodes_billing on public.client_billing_nodes(billing_id);

alter table public.client_billing_nodes enable row level security;

drop policy if exists "staff can read client billing nodes" on public.client_billing_nodes;
drop policy if exists "finance can write client billing nodes" on public.client_billing_nodes;
create policy "staff can read client billing nodes" on public.client_billing_nodes
  for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance','operations'));
create policy "finance can write client billing nodes" on public.client_billing_nodes
  for all to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance'));

grant select, insert, update, delete on public.client_billing_nodes to authenticated;
