-- Restores the prerequisite table referenced by 20260703 payment-request migrations.
create table if not exists public.po_completion_certificates (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  percent_complete numeric not null check (percent_complete > 0 and percent_complete <= 100),
  file_url text,
  file_name text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  notes text,
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.po_completion_certificates enable row level security;
grant select, insert, update on public.po_completion_certificates to authenticated;

drop policy if exists "staff can read certs" on public.po_completion_certificates;
drop policy if exists "staff can insert certs" on public.po_completion_certificates;
drop policy if exists "staff can update certs" on public.po_completion_certificates;
create policy "staff can read certs" on public.po_completion_certificates
  for select to authenticated using (public.is_staff((select auth.uid())));
create policy "staff can insert certs" on public.po_completion_certificates
  for insert to authenticated with check (public.is_staff((select auth.uid())));
create policy "staff can update certs" on public.po_completion_certificates
  for update to authenticated
  using (public.is_staff((select auth.uid())))
  with check (public.is_staff((select auth.uid())));

create index if not exists po_completion_certificates_po_id_idx
  on public.po_completion_certificates (po_id);
create index if not exists po_completion_certificates_po_id_status_idx
  on public.po_completion_certificates (po_id, status);
