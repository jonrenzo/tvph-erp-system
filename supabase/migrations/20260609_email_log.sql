-- ============================================================================
-- Email module: send log + configurable reminder lead-times
-- ============================================================================

-- 1. email_log — one row per send attempt (sent or failed).
--    Used for the PO "Resend" banner, reminder de-duplication, and auditing.
create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind = any (array['po_issued', 'doc_reminder', 'doc_request'])),
  ref_id        uuid,                              -- PO id / document id / vendor id depending on kind
  to_addresses  text[] not null default '{}',
  cc_addresses  text[] not null default '{}',
  subject       text,
  status        text not null default 'sent' check (status = any (array['sent', 'failed'])),
  resend_id     text,                              -- Resend message id when sent
  error         text,                              -- provider/error message when failed
  meta          jsonb not null default '{}'::jsonb,-- e.g. { "milestone": 7 } for doc reminders
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Lookups for the resend banner and reminder de-dup are always by (kind, ref_id).
create index if not exists idx_email_log_kind_ref on public.email_log (kind, ref_id);
create index if not exists idx_email_log_created_at on public.email_log (created_at desc);

alter table public.email_log enable row level security;

-- Staff may read the log; all writes happen through the service-role client
-- (which bypasses RLS), so no write policy is granted to normal users.
drop policy if exists "email_log_staff_read" on public.email_log;
create policy "email_log_staff_read" on public.email_log
  for select to authenticated
  using (public.is_staff(auth.uid()));

grant select on table public.email_log to authenticated;

-- 2. Email/reminder configuration — a singleton settings row owned by this module.
--    (The app references a `system_settings` table that is not provisioned in this
--    database, so email settings live in their own table to stay self-contained.)
--    Default cadence mirrors 30/14/7/1 days before expiry; day 0 always fires.
create table if not exists public.email_settings (
  id            integer primary key default 1 check (id = 1),
  reminder_days integer[] not null default array[30, 14, 7, 1],
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id) on delete set null
);

insert into public.email_settings (id) values (1) on conflict (id) do nothing;

alter table public.email_settings enable row level security;

drop policy if exists "email_settings_staff_read" on public.email_settings;
create policy "email_settings_staff_read" on public.email_settings
  for select to authenticated
  using (public.is_staff(auth.uid()));

grant select on table public.email_settings to authenticated;
