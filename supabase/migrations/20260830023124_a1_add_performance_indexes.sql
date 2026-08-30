-- A1 performance indexes: filtered where deleted_at is null for common list filters
create index if not exists idx_vendors_status_active on public.vendors (status) where deleted_at is null;
create index if not exists idx_purchase_orders_status_active on public.purchase_orders (status) where deleted_at is null;
create index if not exists idx_service_invoices_status_due_date on public.service_invoices (status, due_date);
create index if not exists idx_service_invoices_vendor_status on public.service_invoices (vendor_id, status) where deleted_at is null;
create index if not exists idx_audit_logs_created_at_desc on public.audit_logs (created_at desc);
create index if not exists idx_client_billing_status_due_date on public.client_billing (status, due_date) where deleted_at is null;
