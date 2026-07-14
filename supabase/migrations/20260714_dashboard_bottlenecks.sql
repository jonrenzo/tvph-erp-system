-- Dashboard aggregation, Storage batching support, and notification retention.

-- Client billing tables exist in production but were missing from migration history.
create table if not exists public.client_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.crm_accounts(id) on delete cascade,
  po_number text not null,
  amount numeric not null default 0,
  currency text not null default 'PHP' check (currency in ('PHP', 'USD')),
  received_date date not null,
  status text not null default 'received' check (status in ('received', 'partially_billed', 'fully_billed', 'cancelled')),
  file_url text,
  file_name text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists public.client_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.crm_accounts(id) on delete cascade,
  client_po_id uuid not null references public.client_purchase_orders(id),
  invoice_number text not null,
  amount numeric not null default 0,
  currency text not null default 'PHP' check (currency in ('PHP', 'USD')),
  invoice_date date not null,
  due_date date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'partially_paid', 'paid', 'cancelled')),
  notes text,
  file_url text,
  file_name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.client_invoices(id) on delete cascade,
  amount_paid numeric not null,
  payment_date date not null,
  payment_type text not null check (payment_type in ('full', 'installment', 'down_payment')),
  payment_method text not null check (payment_method in ('cash', 'cheque', 'bank_transfer', 'gcash', 'others')),
  reference_number text,
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  deleted_at timestamptz
);

alter table public.client_purchase_orders enable row level security;
alter table public.client_invoices enable row level security;
alter table public.client_payments enable row level security;

drop policy if exists "staff can read client purchase orders" on public.client_purchase_orders;
drop policy if exists "operations can write client purchase orders" on public.client_purchase_orders;
create policy "staff can read client purchase orders" on public.client_purchase_orders
  for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance', 'operations'));
create policy "operations can write client purchase orders" on public.client_purchase_orders
  for all to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'operations'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'operations'));

drop policy if exists "staff can read client invoices" on public.client_invoices;
drop policy if exists "finance can write client invoices" on public.client_invoices;
create policy "staff can read client invoices" on public.client_invoices
  for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance', 'operations'));
create policy "finance can write client invoices" on public.client_invoices
  for all to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'));

drop policy if exists "auth_access_client_payments" on public.client_payments;
drop policy if exists "finance can read client payments" on public.client_payments;
drop policy if exists "finance can insert client payments" on public.client_payments;
drop policy if exists "finance can update client payments" on public.client_payments;
drop policy if exists "finance can delete client payments" on public.client_payments;
create policy "finance can read client payments" on public.client_payments
  for select to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'));
create policy "finance can insert client payments" on public.client_payments
  for insert to authenticated
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'));
create policy "finance can update client payments" on public.client_payments
  for update to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'))
  with check ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'));
create policy "finance can delete client payments" on public.client_payments
  for delete to authenticated
  using ((select role from public.profiles where id = (select auth.uid())) in ('superadmin', 'admin', 'finance'));
grant select, insert, update, delete on public.client_payments to authenticated;
grant select, insert, update, delete on public.client_purchase_orders, public.client_invoices to authenticated;

create index if not exists idx_client_purchase_orders_account
  on public.client_purchase_orders (account_id) where deleted_at is null;
create index if not exists idx_client_invoices_account
  on public.client_invoices (account_id) where deleted_at is null;
create index if not exists idx_client_invoices_po
  on public.client_invoices (client_po_id) where deleted_at is null;
create index if not exists idx_client_payments_invoice
  on public.client_payments (invoice_id) where deleted_at is null;
create index if not exists idx_client_payments_payment_date_active
  on public.client_payments (payment_date) where deleted_at is null;
create index if not exists idx_payments_payment_date_active
  on public.payments (payment_date) where deleted_at is null;

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
      and role in ('superadmin', 'admin', 'finance')
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
  ar_payments as (
    select
      coalesce(sum(p.amount_paid), 0) as total_paid,
      coalesce(sum(p.amount_paid) filter (where p.payment_date between b.month_start and b.month_end), 0) as paid_this_month
    from public.client_payments p cross join bounds b
    where p.deleted_at is null
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
  client_invoice_payment_totals as (
    select invoice_id, sum(amount_paid) as total_paid
    from public.client_payments
    where deleted_at is null
    group by invoice_id
  ),
  client_invoices as (
    select
      coalesce(sum(greatest(i.amount - coalesce(p.total_paid, 0), 0)), 0) as outstanding,
      coalesce(sum(greatest(i.amount - coalesce(p.total_paid, 0), 0)) filter (where i.due_date < p_today), 0) as overdue
    from public.client_invoices i cross join bounds b
    left join client_invoice_payment_totals p on p.invoice_id = i.id
    where i.deleted_at is null and i.status not in ('paid', 'cancelled')
  ),
  purchase_orders as (
    select coalesce(sum(p.amount), 0) as commitment
    from public.purchase_orders p
    where p.status in ('issued', 'partially_paid') and p.deleted_at is null
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
      select payment_date, amount_paid, 'ar'::text as kind from public.client_payments where deleted_at is null
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
    'ar_collected_this_month', ar_payments.paid_this_month,
    'ar_outstanding', client_invoices.outstanding,
    'ar_overdue', client_invoices.overdue,
    'client_total_paid', ar_payments.total_paid,
    'monthly_trends', trend_json.monthly_trends
  )
  from authorized
  cross join ap
  cross join ar_payments
  cross join invoices
  cross join client_invoices
  cross join purchase_orders
  cross join trend_json;
$$;

create or replace function public.get_dashboard_project_progress()
returns table (
  id uuid,
  name text,
  paid_amount numeric,
  committed_amount numeric,
  pct integer,
  total_invoiced numeric,
  total_dp_amount numeric,
  billing_pct integer,
  completion_pct integer,
  variance integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with active_pos as (
    select id, project_id, amount, coalesce(dp_amount, 0) as dp_amount
    from public.purchase_orders
    where project_id is not null
      and status in ('issued', 'partially_paid', 'paid')
      and deleted_at is null
  ),
  invoice_totals as (
    select i.po_id, sum(i.amount) as total_invoiced
    from public.service_invoices i
    join active_pos po on po.id = i.po_id
    where i.deleted_at is null
    group by i.po_id
  ),
  payment_totals as (
    select i.po_id, sum(p.amount_paid) as total_paid
    from public.payments p
    join public.service_invoices i on i.id = p.invoice_id
    join active_pos po on po.id = i.po_id
    where p.deleted_at is null and i.deleted_at is null
    group by i.po_id
  ),
  certificate_totals as (
    select c.po_id, max(c.percent_complete) as completion_pct
    from public.po_completion_certificates c
    join active_pos po on po.id = c.po_id
    where c.status = 'approved'
    group by c.po_id
  ),
  totals as (
    select
      project.id,
      project.name,
      sum(po.amount) as committed_amount,
      sum(po.dp_amount) as total_dp_amount,
      sum(coalesce(payment.total_paid, 0)) + sum(po.dp_amount) as paid_before_cap,
      sum(coalesce(invoice.total_invoiced, 0)) as total_invoiced,
      sum(coalesce(certificate.completion_pct, 0)) as completion_before_cap
    from public.projects project
    join active_pos po on po.project_id = project.id
    left join invoice_totals invoice on invoice.po_id = po.id
    left join payment_totals payment on payment.po_id = po.id
    left join certificate_totals certificate on certificate.po_id = po.id
    where project.deleted_at is null
    group by project.id, project.name
  ),
  calculated as (
    select
      *,
      least(paid_before_cap, committed_amount) as paid_amount,
      total_invoiced + total_dp_amount as effective_billed,
      least(100::numeric, round(completion_before_cap)) as completion_pct,
      case when committed_amount > 0 then round((least(paid_before_cap, committed_amount) / committed_amount) * 100)::integer else 0 end as pct,
      case when committed_amount > 0 then round(((total_invoiced + total_dp_amount) / committed_amount) * 100)::integer else 0 end as billing_pct
    from totals
  )
  select
    id,
    name,
    paid_amount,
    committed_amount,
    pct,
    total_invoiced,
    total_dp_amount,
    billing_pct,
    completion_pct::integer,
    (completion_pct::integer - billing_pct) as variance
  from calculated
  order by pct;
$$;

revoke all on function public.get_dashboard_financials(date) from public;
revoke all on function public.get_dashboard_project_progress() from public;
grant execute on function public.get_dashboard_financials(date) to authenticated;
grant execute on function public.get_dashboard_project_progress() to authenticated;

do $$
declare job record;
begin
  for job in select jobid from cron.job where jobname = 'delete_old_notifications_daily' loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'delete_old_notifications_daily',
    '15 3 * * *',
    $cleanup$delete from public.notifications where created_at < now() - interval '30 days'$cleanup$
  );
end;
$$;
