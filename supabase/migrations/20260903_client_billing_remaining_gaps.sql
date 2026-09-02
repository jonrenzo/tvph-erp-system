-- invoice_number nullable + partial unique (only when present)
alter table public.client_billing alter column invoice_number drop not null;
create unique index if not exists uq_client_billing_account_invoice
  on public.client_billing(account_id, invoice_number)
  where invoice_number is not null and deleted_at is null;

-- free-text project name when no linked project
alter table public.client_billing add column if not exists project_name_free text;
