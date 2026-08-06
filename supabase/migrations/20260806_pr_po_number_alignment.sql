-- PR numbers always match their PO numbers.
-- 1. PRs share the PO sequence (one counter for both document families).
-- 2. At conversion the PO number is derived from the PR number (prefix swap),
--    so PO-2026000042 is always paired with PR-2026000042. Fallback to the
--    sequence when the derived number is already taken (legacy POs occupy
--    suffixes that in-flight PRs may collide with).
-- 3. Backfill: every PO's pr_number aligns with its own PO number (legacy POs
--    carry phantom PR numbers from the old trigger), and converted PRs are
--    renamed to match their PO where the number is free.

-- 1. PR generator now draws from the shared po_number_seq
create or replace function public.generate_pr_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.pr_number is null or NEW.pr_number = '' then
    NEW.pr_number := 'PR-' || to_char(CURRENT_DATE, 'YYYY') || lpad(nextval('public.po_number_seq')::text, 6, '0');
  end if;
  return NEW;
end;
$$;

-- pr_number_seq is no longer referenced by any trigger
drop sequence if exists public.pr_number_seq;

-- 2. PO generator: converted POs take the PR number with the prefix swapped
--    (only when that number is free), otherwise fall back to the sequence.
create or replace function public.generate_po_number()
returns trigger
language plpgsql
as $$
declare
  v_pr_number text;
  v_candidate text;
begin
  if NEW.po_number is null or NEW.po_number = '' then
    if NEW.purchase_request_id is not null then
      select pr.pr_number into v_pr_number
        from public.purchase_requests pr
        where pr.id = NEW.purchase_request_id;
      if v_pr_number is not null and v_pr_number <> '' then
        v_candidate := 'PO-' || substr(v_pr_number, 4);
        if not exists (select 1 from public.purchase_orders where po_number = v_candidate) then
          NEW.po_number := v_candidate;
          return NEW;
        end if;
      end if;
    end if;
    NEW.po_number := 'PO-' || to_char(CURRENT_DATE, 'YYYY') || lpad(nextval('public.po_number_seq')::text, 6, '0');
  end if;
  return NEW;
end;
$$;

-- 3a. Document rule: every PO carries the PR number that matches its own
--     number. This covers legacy POs with phantom PR numbers from the old
--     purchase_orders pr_number trigger, and linked pairs alike.
update public.purchase_orders
set pr_number = 'PR-' || substr(po_number, 4)
where pr_number is distinct from 'PR-' || substr(po_number, 4);

-- 3b. Rename converted PRs to match their PO where the target is free
--     (skips e.g. PR-29 → PR-45 when a real pending PR-45 already exists).
update public.purchase_requests pr
set pr_number = 'PR-' || substr(po.po_number, 4)
from public.purchase_orders po
where po.purchase_request_id = pr.id
  and pr.pr_number <> 'PR-' || substr(po.po_number, 4)
  and not exists (
    select 1 from public.purchase_requests other
    where other.pr_number = 'PR-' || substr(po.po_number, 4)
  );
