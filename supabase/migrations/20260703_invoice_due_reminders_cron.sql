-- ============================================================================
-- Scheduled invoice-due reminders (pg_cron -> pg_net -> Next.js route)
-- ============================================================================
--
-- This sets up a daily job that POSTs to /api/cron/invoice-due-reminders with a
-- Bearer token. Secrets are read from Supabase Vault at runtime (same vault
-- entries used by the document-expiry reminders; no extra operator setup).
--
-- The job no-ops until both secrets exist, so applying this migration is safe
-- even before the secrets are configured.
-- ============================================================================

-- 1. Reminder function — fires 14 days before the invoice due_date.

create or replace function public.trigger_invoice_due_reminders()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  secret   text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'cron_secret';

  if base_url is null or secret is null then
    raise notice 'invoice-due-reminders skipped: app_base_url / cron_secret vault secret missing';
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/api/cron/invoice-due-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- 2. Schedule daily at 00:00 UTC (08:00 PHT). Idempotent.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'invoice-due-reminders') then
    perform cron.unschedule('invoice-due-reminders');
  end if;

  perform cron.schedule(
    'invoice-due-reminders',
    '0 0 * * *',
    $cron$ select public.trigger_invoice_due_reminders(); $cron$
  );
end $$;
