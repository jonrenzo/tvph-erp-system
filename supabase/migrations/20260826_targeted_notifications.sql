-- Targeted in-app notifications: one row per recipient, superadmin sees all.

-- 1. Column
alter table public.notifications
  add column if not exists recipient_id uuid references auth.users(id);

create index if not exists idx_notifications_recipient on public.notifications (recipient_id);
create index if not exists idx_notifications_recipient_read on public.notifications (recipient_id, is_read);

-- 2. Backfill: each user keeps their own history; cron/portal rows with no creator stay hidden
--    (they are low-signal broadcast rows; superadmin can still see them via RLS bypass if needed,
--     but per plan we delete them as noise).
update public.notifications set recipient_id = created_by
where recipient_id is null and created_by is not null;

-- Remove orphan broadcast rows that had no creator (cron). They would be invisible to everyone
-- even with superadmin bypass if we keep the write-own restriction. Delete is cleaner.
delete from public.notifications where recipient_id is null;

-- 3. RLS: replace broadcast policies with targeted + superadmin bypass (read-all, write-own)
drop policy if exists "Authenticated users can read notifications" on public.notifications;
drop policy if exists "Authenticated users can mark notifications as read" on public.notifications;
drop policy if exists "Authenticated users can delete notifications" on public.notifications;

create policy "Users can read own or superadmin all" on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "Users can mark own as read" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "Users can delete own" on public.notifications
  for delete to authenticated
  using (recipient_id = auth.uid());
