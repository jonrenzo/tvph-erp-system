-- Invoice-driven Payment Request: 1 invoice = 1 PR, many PRs per PO allowed.
-- Adds invoice_id link and lifts the single-active-PR constraint.

-- 1. Add invoice_id to payment_requests (nullable for legacy rows).
alter table public.payment_requests
  add column if not exists invoice_id uuid references public.service_invoices(id) on delete set null;

create index if not exists payment_requests_invoice_id_idx
  on public.payment_requests(invoice_id);

-- 2. Drop the single-active-PR-per-PO constraint (now many PRs per PO allowed).
drop index if exists public.payment_requests_one_active_per_po;

-- 3. Extend status to include fully_invoiced if not already present
--    (trigger sync_payment_request_invoiced_status already uses it).
do $$
begin
  -- Drop old check if present, add new one with fully_invoiced
  alter table public.payment_requests drop constraint if exists payment_requests_status_check;
  alter table public.payment_requests
    add constraint payment_requests_status_check
    check (status = any (array['pending','approved','rejected','fully_invoiced']));
exception when others then null;
end $$;

-- 4. Add is_downpayment if not exists (used by UI, may already exist via drift).
alter table public.payment_requests
  add column if not exists is_downpayment boolean not null default false;

-- 5. Add request_number if not exists (some envs have it, ensure existence for new rows).
alter table public.payment_requests
  add column if not exists request_number text;

-- 6. Backfill request_number for any rows missing it (best-effort).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='payment_requests' and column_name='request_number') then
    update public.payment_requests
    set request_number = 'PR-' || substr(id::text, 1, 8)
    where request_number is null;
  end if;
end $$;
