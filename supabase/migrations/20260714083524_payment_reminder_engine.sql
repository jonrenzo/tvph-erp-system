alter table public.purchase_orders
  add column if not exists net_days integer not null default 30 check (net_days > 0),
  add column if not exists dp_due_days integer check (dp_due_days >= 0),
  add column if not exists penalty_rate numeric(5,4) check (penalty_rate between 0 and 1),
  add column if not exists penalty_type text check (penalty_type in ('monthly', 'fixed')),
  add column if not exists terms_configured_at timestamptz;

create table if not exists public.po_penalties (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references public.purchase_orders(id) on delete cascade,
  calculated_amount numeric(14,2) not null default 0,
  override_amount numeric(14,2),
  override_reason text,
  first_overdue_on date,
  last_calculated_on date,
  overridden_by uuid references public.profiles(id),
  overridden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (override_amount is null and override_reason is null) or
    (override_amount is not null and length(trim(override_reason)) > 0)
  )
);

create unique index if not exists po_penalties_po_id_idx on public.po_penalties (po_id);
create index if not exists purchase_orders_terms_due_idx
  on public.purchase_orders (due_date)
  where terms_configured_at is not null and deleted_at is null;

alter table public.po_penalties enable row level security;
grant select, insert, update on public.po_penalties to authenticated;

create policy "staff can read PO penalties"
  on public.po_penalties for select to authenticated
  using (public.is_staff((select auth.uid())));

create policy "staff can write PO penalties"
  on public.po_penalties for all to authenticated
  using (public.is_staff((select auth.uid())))
  with check (public.is_staff((select auth.uid())));

alter table public.email_settings
  add column if not exists invoice_due_reminder_days integer not null default 7
    check (invoice_due_reminder_days > 0),
  add column if not exists vendor_deadline_warning_days integer[] not null default array[7, 5],
  add column if not exists vendor_overdue_repeat_days integer not null default 7
    check (vendor_overdue_repeat_days > 0);

alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind = any (array[
  'po_issued', 'po_pending_approval', 'doc_reminder', 'doc_request', 'invoice_due_reminder',
  'invoice_due_date', 'vendor_deadline_reminder'
]));

create or replace function public.trigger_vendor_deadline_reminders()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';

  if base_url is null or secret is null then
    return;
  end if;

  perform net.http_post(
    url := base_url || '/api/cron/vendor-deadline-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := '{}'::jsonb
  );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vendor-deadline-reminders') then
    perform cron.unschedule('vendor-deadline-reminders');
  end if;

  perform cron.schedule(
    'vendor-deadline-reminders',
    '0 0 * * *',
    $cron$ select public.trigger_vendor_deadline_reminders(); $cron$
  );
end $$;
