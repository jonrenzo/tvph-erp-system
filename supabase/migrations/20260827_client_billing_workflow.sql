-- Client Billing Workflow: replaces client_invoices / client_payments Excel workflow.
-- Grain: one row = one invoice linked to crm_accounts + optionally projects. Batch is free-text tag, region/nodes are row snapshots.

-- 1. Core table
create table if not exists public.client_billing (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.crm_accounts(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  invoice_number text not null,
  invoice_batch text,
  num_nodes integer,
  region text,
  amount_vat_ex numeric not null default 0,
  amount_vat_inc numeric not null default 0,
  date_issued date not null default current_date,
  date_endorsed date,
  due_date date,
  est_payment_date date,
  status text not null default 'for_billing' check (status in ('for_billing','for_approval','for_payment','pending_payment','collected')),
  notes text,
  file_url text,
  file_name text,
  collected_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- 2. Timeline (per-record event history for the UI; audit_logs remains the compliance log)
create table if not exists public.client_billing_timeline (
  id uuid primary key default gen_random_uuid(),
  billing_id uuid not null references public.client_billing(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz default now(),
  note text
);

create index if not exists idx_client_billing_account on public.client_billing(account_id) where deleted_at is null;
create index if not exists idx_client_billing_project on public.client_billing(project_id) where deleted_at is null;
create index if not exists idx_client_billing_status on public.client_billing(status) where deleted_at is null;
create index if not exists idx_client_billing_due_date on public.client_billing(due_date) where deleted_at is null;
create index if not exists idx_client_billing_invoice_number on public.client_billing(invoice_number) where deleted_at is null;
create index if not exists idx_client_billing_timeline_billing on public.client_billing_timeline(billing_id);

alter table public.client_billing enable row level security;
alter table public.client_billing_timeline enable row level security;

drop policy if exists "staff can read client billing" on public.client_billing;
drop policy if exists "finance can write client billing" on public.client_billing;
create policy "staff can read client billing" on public.client_billing
  for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance','operations'));
create policy "finance can write client billing" on public.client_billing
  for all to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance'));

drop policy if exists "staff can read client billing timeline" on public.client_billing_timeline;
drop policy if exists "finance can write client billing timeline" on public.client_billing_timeline;
create policy "staff can read client billing timeline" on public.client_billing_timeline
  for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance','operations'));
create policy "finance can write client billing timeline" on public.client_billing_timeline
  for all to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin','admin','finance'));

grant select, insert, update, delete on public.client_billing, public.client_billing_timeline to authenticated;

-- 3. Replace dashboard financials to use client_billing (was client_invoices/client_payments).
--    Outstanding = amount_vat_inc where not collected. Overdue = due_date < p_today while in payment phases.
--    Collected total/this_month derived from collected rows (amount_vat_inc, collected_at).
create or replace function public.get_dashboard_financials(p_today date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with authorized as (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('superadmin','admin','finance')
  ),
  bounds as (
    select
      date_trunc('month', p_today)::date as month_start,
      (date_trunc('month', p_today) + interval '1 month - 1 day')::date as month_end,
      (date_trunc('month', p_today) - interval '5 months')::date as trend_start
  ),
  ap as (
    select
      coalesce(sum(p.amount_paid), 0) as total_paid,
      coalesce(sum(p.amount_paid) filter (where p.payment_date between b.month_start and b.month_end), 0) as paid_this_month
    from public.payments p cross join bounds b
    where p.deleted_at is null
  ),
  ar_billing as (
    select
      coalesce(sum(cb.amount_vat_inc) filter (where cb.status = 'collected' and cb.deleted_at is null), 0) as total_collected,
      coalesce(sum(cb.amount_vat_inc) filter (where cb.status = 'collected' and cb.deleted_at is null and cb.collected_at::date between b.month_start and b.month_end), 0) as collected_this_month,
      coalesce(sum(cb.amount_vat_inc) filter (where cb.deleted_at is null and cb.status <> 'collected'), 0) as outstanding,
      coalesce(sum(cb.amount_vat_inc) filter (where cb.deleted_at is null and cb.status in ('for_payment','pending_payment') and cb.due_date is not null and cb.due_date < p_today), 0) as overdue
    from public.client_billing cb cross join bounds b
  ),
  invoice_payment_totals as (
    select invoice_id, sum(amount_paid) as total_paid
    from public.payments
    where deleted_at is null
    group by invoice_id
  ),
  invoices as (
    select
      coalesce(sum(greatest(i.amount - coalesce(p.total_paid, 0), 0)) filter (where i.deleted_at is null and i.status <> 'paid'), 0) as total_unpaid,
      coalesce(sum(greatest(i.amount - coalesce(p.total_paid, 0), 0)) filter (where i.deleted_at is null and i.status <> 'paid' and i.due_date < p_today), 0) as overdue
    from public.service_invoices i
    left join invoice_payment_totals p on p.invoice_id = i.id
  ),
  purchase_orders as (
    select coalesce(sum(p.amount), 0) as commitment
    from public.purchase_orders p
    where p.status in ('issued','partially_paid') and p.deleted_at is null
  ),
  months as (
    select generate_series(b.trend_start, b.month_start, interval '1 month')::date as month_start
    from bounds b
  ),
  monthly as (
    select
      m.month_start,
      coalesce(sum(p.amount_paid) filter (where p.kind = 'ap'), 0) as ap_paid,
      coalesce(sum(p.amount_paid) filter (where p.kind = 'ar'), 0) as ar_collected
    from months m
    left join (
      select payment_date, amount_paid, 'ap'::text as kind from public.payments where deleted_at is null
      union all
      select cb.collected_at::date as payment_date, cb.amount_vat_inc as amount_paid, 'ar'::text as kind
      from public.client_billing cb
      where cb.deleted_at is null and cb.status = 'collected' and cb.collected_at is not null
    ) p on p.payment_date >= m.month_start
      and p.payment_date < (m.month_start + interval '1 month')::date
    group by m.month_start
  ),
  trend_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(month_start, 'Mon'),
      'ap_paid', ap_paid,
      'ar_collected', ar_collected
    ) order by month_start), '[]'::jsonb) as monthly_trends
    from monthly
  )
  select jsonb_build_object(
    'total_po_commitment', purchase_orders.commitment,
    'total_paid', ap.total_paid,
    'total_invoiced', invoices.total_unpaid,
    'ap_paid_this_month', ap.paid_this_month,
    'ap_overdue', invoices.overdue,
    'ar_collected_this_month', ar_billing.collected_this_month,
    'ar_outstanding', ar_billing.outstanding,
    'ar_overdue', ar_billing.overdue,
    'client_total_paid', ar_billing.total_collected,
    'monthly_trends', trend_json.monthly_trends
  )
  from authorized
  cross join ap
  cross join ar_billing
  cross join invoices
  cross join purchase_orders
  cross join trend_json;
$$;

-- 4. Drop legacy AR tables (commit after financials above is rewired; keep if external deps exist).
drop policy if exists "staff can read client invoices" on public.client_invoices;
drop policy if exists "finance can write client invoices" on public.client_invoices;
drop policy if exists "finance can read client payments" on public.client_payments;
drop policy if exists "finance can insert client payments" on public.client_payments;
drop policy if exists "finance can update client payments" on public.client_payments;
drop policy if exists "finance can delete client payments" on public.client_payments;
drop policy if exists "auth_access_client_payments" on public.client_payments;
drop table if exists public.client_payments cascade;
drop table if exists public.client_invoices cascade;
