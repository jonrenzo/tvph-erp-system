-- Reconcile a schema-drift name collision on public.payment_requests.
--
-- Background: two features shipped on 2025-07-03 —
--   * 20260703_payment_requests.sql     -> table payment_requests    (column: amount,          status pending/approved/rejected)
--   * 20260703_payment_reservations.sql -> table payment_reservations (column: reserved_amount, status pending/acknowledged/paid/cancelled)
-- On some databases an earlier (reservation-shaped) object already occupied the
-- name `payment_requests`, so `create table public.payment_requests (... amount ...)`
-- hit "relation already exists" and never applied. The app inserts `amount` into
-- payment_requests and fails with "could not find the 'amount' column ... in the
-- schema cache", because the live object is reservation-shaped (has reserved_amount,
-- lacks amount, and lacks due_in_days/notes/completion_cert_id/percent_complete/
-- created_by/approved_*/rejected_*).
--
-- This migration is SAFE on both kinds of database:
--   * Drifted DB: the orphan (reservation-shaped payment_requests) is retired and the
--     correct table is created.
--   * Clean DB: payment_requests already has `amount`; the guard below does NOT touch
--     it, and `create table if not exists` is a no-op.
-- The orphan is retired ONLY when it has reserved_amount AND lacks amount, so a correct
-- table is never dropped. (The reservation-shaped orphan carries 0 rows in the affected
-- environment; guarding on shape rather than name is what makes this non-destructive.)

do $$
declare
  v_kind text;
  v_has_amount boolean;
  v_has_reserved boolean;
begin
  select table_type into v_kind
  from information_schema.tables
  where table_schema = 'public' and table_name = 'payment_requests';

  if v_kind is null then
    -- No object by this name; nothing to retire. The create below will build it.
    return;
  end if;

  select
    bool_or(column_name = 'amount'),
    bool_or(column_name = 'reserved_amount')
  into v_has_amount, v_has_reserved
  from information_schema.columns
  where table_schema = 'public' and table_name = 'payment_requests';

  -- Only retire the reservation-shaped orphan. Never drop the correct table.
  if coalesce(v_has_reserved, false) and not coalesce(v_has_amount, false) then
    if v_kind = 'VIEW' then
      execute 'drop view public.payment_requests';
    else
      execute 'drop table public.payment_requests';
    end if;
  end if;
end $$;

-- Create the intended Payment Request entity (mirrors 20260703_payment_requests.sql).
create table if not exists public.payment_requests (
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

-- Only one active (pending or approved) PR per PO at a time.
create unique index if not exists payment_requests_one_active_per_po
  on public.payment_requests(po_id)
  where status in ('pending', 'approved');

create index if not exists payment_requests_po_id_idx              on public.payment_requests(po_id);
create index if not exists payment_requests_status_idx            on public.payment_requests(status);
create index if not exists payment_requests_project_id_idx        on public.payment_requests(project_id);
create index if not exists payment_requests_completion_cert_id_idx on public.payment_requests(completion_cert_id);

alter table public.payment_requests enable row level security;

drop policy if exists "staff can read payment_requests"   on public.payment_requests;
drop policy if exists "staff can insert payment_requests" on public.payment_requests;
drop policy if exists "staff can update payment_requests" on public.payment_requests;

create policy "staff can read payment_requests"
  on public.payment_requests for select
  using (public.is_staff(auth.uid()));

create policy "staff can insert payment_requests"
  on public.payment_requests for insert
  with check (public.is_staff(auth.uid()));

create policy "staff can update payment_requests"
  on public.payment_requests for update
  using (public.is_staff(auth.uid()));

-- Refresh PostgREST's schema cache so the Data API sees the new table/columns
-- immediately (otherwise the app can hit a twin "not found in schema cache" error).
notify pgrst, 'reload schema';
