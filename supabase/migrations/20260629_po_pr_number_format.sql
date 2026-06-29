-- Reformat PO numbers: PO-YYYY-NNNN → PO-YYYYNNNNNN (no inner dash, 6-digit pad)
-- Add auto-generated PR numbers: PR-YYYYNNNNNN

-- 1. Update PO number generator to new format
create or replace function public.generate_po_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.po_number is null or NEW.po_number = '' then
    NEW.po_number := 'PO-' || to_char(CURRENT_DATE, 'YYYY') || lpad(nextval('public.po_number_seq')::text, 6, '0');
  end if;
  return NEW;
end;
$$;

-- 2. Migrate existing PO numbers to new format
update public.purchase_orders
set po_number = 'PO-' || split_part(po_number, '-', 2) || lpad(split_part(po_number, '-', 3), 6, '0')
where po_number ~ '^PO-\d{4}-\d+$';

-- 3. PR number sequence
create sequence if not exists public.pr_number_seq start 1;

-- 4. PR number generator
create or replace function public.generate_pr_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.pr_number is null or NEW.pr_number = '' then
    NEW.pr_number := 'PR-' || to_char(CURRENT_DATE, 'YYYY') || lpad(nextval('public.pr_number_seq')::text, 6, '0');
  end if;
  return NEW;
end;
$$;

-- 5. Attach trigger
drop trigger if exists set_pr_number on public.purchase_orders;
create trigger set_pr_number
  before insert on public.purchase_orders
  for each row
  execute function public.generate_pr_number();
