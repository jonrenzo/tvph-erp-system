-- ============================================================================
-- CRM Customer Enrollment Counterpart (Vendor-style customer master data)
-- ============================================================================

alter table public.crm_accounts
  add column if not exists registered_address text;

alter table public.crm_accounts
  add column if not exists tin text;

alter table public.crm_accounts
  add column if not exists status text;

update public.crm_accounts
set status = case
  when company_type = 'active_customer' then 'active'
  when company_type = 'inactive_customer' then 'inactive'
  else 'pending'
end
where status is null
   or btrim(status) = '';

alter table public.crm_accounts
  alter column status set default 'pending';

alter table public.crm_accounts
  alter column status set not null;

alter table public.crm_accounts
  drop constraint if exists crm_accounts_status_check;

alter table public.crm_accounts
  add constraint crm_accounts_status_check
  check (status = any (array['pending', 'active', 'inactive']));

alter table public.crm_contacts
  add column if not exists fax text;

create index if not exists idx_crm_accounts_status_active
  on public.crm_accounts(status)
  where deleted_at is null;
