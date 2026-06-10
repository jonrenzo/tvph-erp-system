-- ============================================================================
-- Scheduled document-expiry reminders (pg_cron -> pg_net -> Next.js route)
-- ============================================================================
--
-- This sets up a daily job that POSTs to /api/cron/document-reminders with a
-- Bearer token. To keep secrets OUT of git, the base URL and the shared secret
-- are read from Supabase Vault at runtime.
--
-- ONE-TIME OPERATOR SETUP (run once per environment, e.g. via the SQL editor):
--
--   select vault.create_secret('https://your-app-domain.com', 'app_base_url');
--   select vault.create_secret('<same value as CRON_SECRET env var>', 'cron_secret');
--
-- The job no-ops until both secrets exist, so applying this migration is safe
-- even before the secrets are configured.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reads the two vault secrets and fires the reminder endpoint. SECURITY DEFINER
-- so the cron owner can read vault + use pg_net regardless of caller role.
create or replace function public.trigger_document_reminders()
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

  -- Skip quietly until the operator has configured both secrets.
  if base_url is null or secret is null then
    raise notice 'document-reminders skipped: app_base_url / cron_secret vault secret missing';
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/api/cron/document-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Schedule daily at 00:00 UTC (08:00 PHT). Unschedule first to stay idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'document-expiry-reminders') then
    perform cron.unschedule('document-expiry-reminders');
  end if;

  perform cron.schedule(
    'document-expiry-reminders',
    '0 0 * * *',
    $cron$ select public.trigger_document_reminders(); $cron$
  );
end $$;
