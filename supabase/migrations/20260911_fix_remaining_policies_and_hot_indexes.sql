-- remaining multiple permissive fixes: split * policies that overlap SELECT

-- node_status: split write * into write-only
drop policy if exists node_status_write_policy on public.node_status;
create policy node_status_write_policy_insert on public.node_status for insert with check (is_staff((select auth.uid())));
create policy node_status_write_policy_update on public.node_status for update using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
create policy node_status_write_policy_delete on public.node_status for delete using (is_staff((select auth.uid())));

-- vendor_sync_state: same
drop policy if exists vendor_sync_state_write_policy on public.vendor_sync_state;
create policy vendor_sync_state_write_policy_insert on public.vendor_sync_state for insert with check (is_staff((select auth.uid())));
create policy vendor_sync_state_write_policy_update on public.vendor_sync_state for update using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
create policy vendor_sync_state_write_policy_delete on public.vendor_sync_state for delete using (is_staff((select auth.uid())));

-- client_billing_nodes: finance can write * -> write-only
drop policy if exists "finance can write client billing nodes" on public.client_billing_nodes;
create policy "finance can write client billing nodes_insert" on public.client_billing_nodes for insert with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
create policy "finance can write client billing nodes_update" on public.client_billing_nodes for update using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance']))) with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
create policy "finance can write client billing nodes_delete" on public.client_billing_nodes for delete using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));

-- client_billing_timeline: same
drop policy if exists "finance can write client billing timeline" on public.client_billing_timeline;
create policy "finance can write client billing timeline_insert" on public.client_billing_timeline for insert with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
create policy "finance can write client billing timeline_update" on public.client_billing_timeline for update using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance']))) with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));
create policy "finance can write client billing timeline_delete" on public.client_billing_timeline for delete using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','finance'])));

-- po_penalties: staff can write * -> write-only
drop policy if exists "staff can write PO penalties" on public.po_penalties;
create policy "staff can write PO penalties_insert" on public.po_penalties for insert with check (is_staff((select auth.uid())));
create policy "staff can write PO penalties_update" on public.po_penalties for update using (is_staff((select auth.uid()))) with check (is_staff((select auth.uid())));
create policy "staff can write PO penalties_delete" on public.po_penalties for delete using (is_staff((select auth.uid())));

-- system_settings: staff_write * -> write-only (read already covered by staff_read r true)
drop policy if exists system_settings_staff_write on public.system_settings;
create policy system_settings_staff_write_insert on public.system_settings for insert with check (true);
create policy system_settings_staff_write_update on public.system_settings for update using (true) with check (true);
create policy system_settings_staff_write_delete on public.system_settings for delete using (true);

-- magic_links: staff_all * overlapped public_read r on SELECT for authenticated -> split staff_all into read + write
drop policy if exists magic_links_staff_all on public.magic_links;
create policy magic_links_staff_read on public.magic_links for select using (true);
create policy magic_links_staff_insert on public.magic_links for insert with check (true);
create policy magic_links_staff_update on public.magic_links for update using (true) with check (true);
create policy magic_links_staff_delete on public.magic_links for delete using (true);

-- client_purchase_orders: split both * policies into write-only, keep staff read for SELECT
drop policy if exists auth_access_client_pos on public.client_purchase_orders;
create policy auth_access_client_pos_select on public.client_purchase_orders for select using (((select auth.role()) = 'authenticated'));
create policy auth_access_client_pos_insert on public.client_purchase_orders for insert with check (((select auth.role()) = 'authenticated'));
create policy auth_access_client_pos_update on public.client_purchase_orders for update using (((select auth.role()) = 'authenticated')) with check (((select auth.role()) = 'authenticated'));
create policy auth_access_client_pos_delete on public.client_purchase_orders for delete using (((select auth.role()) = 'authenticated'));
drop policy if exists "operations can write client purchase orders" on public.client_purchase_orders;
create policy "operations can write client purchase orders_insert" on public.client_purchase_orders for insert with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','operations'])));
create policy "operations can write client purchase orders_update" on public.client_purchase_orders for update using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','operations']))) with check (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','operations'])));
create policy "operations can write client purchase orders_delete" on public.client_purchase_orders for delete using (((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = any (array['superadmin','admin','operations'])));

-- hot FK indexes (only 3 high-join tables, not all 58)
create index if not exists idx_pr_line_items_pr_id on public.pr_line_items (pr_id);
create index if not exists idx_project_vendors_vendor_id on public.project_vendors (vendor_id);
create index if not exists idx_vendor_document_files_uploaded_by on public.vendor_document_files (uploaded_by);
