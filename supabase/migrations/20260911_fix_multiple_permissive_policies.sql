-- fix multiple permissive policies: split * (ALL) policies that overlap SELECT into INSERT/UPDATE/DELETE only
-- purchase_orders: po_write_policy was * overlapping po_read_policy on SELECT
drop policy if exists po_write_policy on public.purchase_orders;
create policy po_write_policy_insert on public.purchase_orders for insert with check (is_staff((select auth.uid())));
create policy po_write_policy_update on public.purchase_orders for update using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
create policy po_write_policy_delete on public.purchase_orders for delete using (is_staff((select auth.uid())));

-- purchase_requests: same pattern
drop policy if exists pr_write_policy on public.purchase_requests;
create policy pr_write_policy_insert on public.purchase_requests for insert with check (is_staff((select auth.uid())));
create policy pr_write_policy_update on public.purchase_requests for update using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
create policy pr_write_policy_delete on public.purchase_requests for delete using (is_staff((select auth.uid())));

-- vendors: same pattern
drop policy if exists vendors_write_policy on public.vendors;
create policy vendors_write_policy_insert on public.vendors for insert with check (is_staff((select auth.uid())));
create policy vendors_write_policy_update on public.vendors for update using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
create policy vendors_write_policy_delete on public.vendors for delete using (is_staff((select auth.uid())));

-- tvph_documents: 4 overlapping authenticated true policies -> keep only full access
drop policy if exists "Allow authenticated inserts to tvph_documents" on public.tvph_documents;
drop policy if exists "Allow authenticated select from tvph_documents" on public.tvph_documents;
drop policy if exists "Allow authenticated updates to tvph_documents" on public.tvph_documents;
-- keep "Allow authenticated full access" as the single permissive policy

-- client_billing: finance can write was * overlapping staff can read on SELECT
drop policy if exists "finance can write client billing" on public.client_billing;
create policy "finance can write client billing_insert" on public.client_billing for insert with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
create policy "finance can write client billing_update" on public.client_billing for update using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance']))) with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
create policy "finance can write client billing_delete" on public.client_billing for delete using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
