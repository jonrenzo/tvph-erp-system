-- fix auth RLS initplan: wrap auth.uid() in (select ...) to avoid per-row re-evaluation
drop policy if exists "Users can read own or superadmin all" on public.notifications;
create policy "Users can read own or superadmin all" on public.notifications for select
  using ((recipient_id = (select auth.uid())) or is_superadmin((select auth.uid())));

drop policy if exists "Users can mark own as read" on public.notifications;
create policy "Users can mark own as read" on public.notifications for update
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

drop policy if exists "Users can delete own" on public.notifications;
create policy "Users can delete own" on public.notifications for delete
  using (recipient_id = (select auth.uid()));

drop policy if exists node_status_read_policy on public.node_status;
create policy node_status_read_policy on public.node_status for select using (is_staff((select auth.uid())));
drop policy if exists node_status_write_policy on public.node_status;
create policy node_status_write_policy on public.node_status for all using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));

drop policy if exists vendor_sync_state_read_policy on public.vendor_sync_state;
create policy vendor_sync_state_read_policy on public.vendor_sync_state for select using (is_staff((select auth.uid())));
drop policy if exists vendor_sync_state_write_policy on public.vendor_sync_state;
create policy vendor_sync_state_write_policy on public.vendor_sync_state for all using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
