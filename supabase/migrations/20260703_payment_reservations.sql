create table public.payment_reservations (
  id               uuid        primary key default gen_random_uuid(),
  po_id            uuid        not null references public.purchase_orders(id) on delete cascade,
  project_id       uuid        references public.projects(id) on delete set null,
  vendor_id        uuid        references public.vendors(id) on delete set null,
  reserved_amount  numeric(15,2) not null,
  status           text        not null default 'pending'
                               check (status in ('pending', 'acknowledged', 'paid', 'cancelled')),
  notified_by      uuid        references public.profiles(id),
  notified_at      timestamptz not null default now(),
  acknowledged_by  uuid        references public.profiles(id),
  acknowledged_at  timestamptz,
  cancelled_by     uuid        references public.profiles(id),
  cancelled_reason text,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- Only one active (pending or acknowledged) reservation per PO at a time
create unique index payment_reservations_one_active_per_po
  on public.payment_reservations(po_id)
  where status in ('pending', 'acknowledged');

create index on public.payment_reservations(po_id);
create index on public.payment_reservations(status);
create index on public.payment_reservations(project_id);

alter table public.payment_reservations enable row level security;

create policy "staff can read reservations"
  on public.payment_reservations for select
  using (public.is_staff(auth.uid()));

create policy "staff can insert reservations"
  on public.payment_reservations for insert
  with check (public.is_staff(auth.uid()));

create policy "staff can update reservations"
  on public.payment_reservations for update
  using (public.is_staff(auth.uid()));
