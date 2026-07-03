create table public.payment_requests (
  id                 uuid        primary key default gen_random_uuid(),
  po_id              uuid        not null references public.purchase_orders(id) on delete cascade,
  vendor_id          uuid        references public.vendors(id) on delete set null,
  project_id         uuid        references public.projects(id) on delete set null,
  amount             numeric(15,2) not null,
  due_in_days        integer     not null default 30,
  notes              text,
  completion_cert_id uuid        references public.po_completion_certificates(id) on delete set null,
  percent_complete   numeric(5,2),
  status             text        not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  created_by         uuid        references public.profiles(id),
  created_at         timestamptz not null default now(),
  approved_by        uuid        references public.profiles(id),
  approved_at        timestamptz,
  rejected_by        uuid        references public.profiles(id),
  rejected_at        timestamptz,
  rejection_reason   text
);

-- Only one active (pending or approved) PR per PO at a time
create unique index payment_requests_one_active_per_po
  on public.payment_requests(po_id)
  where status in ('pending', 'approved');

create index on public.payment_requests(po_id);
create index on public.payment_requests(status);
create index on public.payment_requests(project_id);
create index on public.payment_requests(completion_cert_id);

alter table public.payment_requests enable row level security;

create policy "staff can read payment_requests"
  on public.payment_requests for select
  using (public.is_staff(auth.uid()));

create policy "staff can insert payment_requests"
  on public.payment_requests for insert
  with check (public.is_staff(auth.uid()));

create policy "staff can update payment_requests"
  on public.payment_requests for update
  using (public.is_staff(auth.uid()));
