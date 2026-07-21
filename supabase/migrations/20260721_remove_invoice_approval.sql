-- Remove the approval step from vendor (AP) invoices and collapse the status model.
--
-- Background: the "Approve" action used to run approve_invoice_consume_balance, which
-- consumed the linked payment request's balance, set the invoice to 'approved', and
-- flipped the payment request to 'fully_invoiced'. We are removing manual approval:
-- invoices now RESERVE the payment request balance the moment they are created, and the
-- status set collapses to pending_payment -> partially_paid -> paid.
--
-- The payment_requests 'approved' <-> 'fully_invoiced' toggle (used across the UI) is now
-- maintained automatically by a trigger on service_invoices, so no manual RPC call is
-- needed on create / pay / delete.
--
-- This migration also ADOPTS previously out-of-band schema (columns + RPCs that existed
-- only in the live database) so the repo is self-consistent for a fresh build.

-- 1. Adopt drifted columns (previously applied directly to the live DB). Idempotent.
alter table public.service_invoices add column if not exists payment_request_id uuid references public.payment_requests(id);
alter table public.service_invoices add column if not exists carry_forward_amount numeric;
alter table public.service_invoices add column if not exists override_by uuid references auth.users(id);
alter table public.service_invoices add column if not exists override_at timestamptz;
alter table public.service_invoices add column if not exists override_reason text;

-- 2. Safety report: any payment request that would be over-consumed once previously
--    'disputed' invoices are folded back into the consuming set. (No rows expected.)
do $$
declare r record;
begin
  for r in
    select pr.id, pr.request_number, pr.amount,
           sum(si.amount) as would_consume
    from public.payment_requests pr
    join public.service_invoices si on si.payment_request_id = pr.id
    where si.deleted_at is null
      and si.status in ('received','under_review','approved','partially_paid','paid','disputed')
    group by pr.id, pr.request_number, pr.amount
    having sum(si.amount) > pr.amount
  loop
    raise notice 'REVIEW: payment request % (amount %) would be over-consumed by folded invoices: %',
      r.request_number, r.amount, r.would_consume;
  end loop;
end $$;

-- 3. Drop the old CHECK first so the backfill can write the new value.
alter table public.service_invoices drop constraint if exists service_invoices_status_check;

-- 4. Collapse existing statuses into the new model, then apply the new CHECK.
update public.service_invoices
set status = 'pending_payment'
where status in ('received','under_review','approved','disputed');

alter table public.service_invoices
  add constraint service_invoices_status_check
  check (status = any (array['pending_payment','partially_paid','paid']));

-- 5. New rows default to pending_payment.
alter table public.service_invoices alter column status set default 'pending_payment';

-- 6. Keep payment_requests.status in sync with the invoices that consume it.
--    Consuming statuses now include 'pending_payment' (reserve-on-create). Only PRs already
--    in the billable lifecycle ('approved'/'fully_invoiced') are toggled; 'pending'/'rejected'
--    PRs are left untouched. Runs as the invoker (not SECURITY DEFINER): every invoice-
--    mutating path is staff, and the is_staff RLS policy already permits staff to update
--    payment_requests (a non-staff caller's inner UPDATE is RLS-blocked to zero rows).
--    search_path is pinned.
create or replace function public.sync_payment_request_invoiced_status(p_pr_id uuid)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_pr       record;
  v_consumed numeric;
begin
  if p_pr_id is null then
    return;
  end if;

  select * into v_pr from public.payment_requests where id = p_pr_id for update;
  if not found then
    return;
  end if;
  if v_pr.status not in ('approved','fully_invoiced') then
    return;
  end if;

  select coalesce(sum(amount), 0) into v_consumed
  from public.service_invoices
  where payment_request_id = p_pr_id
    and status in ('pending_payment','partially_paid','paid')
    and deleted_at is null;

  if v_consumed >= v_pr.amount then
    if v_pr.status <> 'fully_invoiced' then
      update public.payment_requests set status = 'fully_invoiced' where id = p_pr_id;
    end if;
  else
    if v_pr.status <> 'approved' then
      update public.payment_requests set status = 'approved' where id = p_pr_id;
    end if;
  end if;
end;
$$;

create or replace function public.trg_service_invoice_sync_pr()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_payment_request_invoiced_status(old.payment_request_id);
    return old;
  end if;

  perform public.sync_payment_request_invoiced_status(new.payment_request_id);

  if tg_op = 'UPDATE' and old.payment_request_id is distinct from new.payment_request_id then
    perform public.sync_payment_request_invoiced_status(old.payment_request_id);
  end if;

  return new;
end;
$$;

drop trigger if exists service_invoice_sync_pr on public.service_invoices;
create trigger service_invoice_sync_pr
after insert or delete or update of amount, status, deleted_at, payment_request_id
on public.service_invoices
for each row execute function public.trg_service_invoice_sync_pr();

-- 7. Resync every billable PR so their status reflects the collapsed invoice statuses.
do $$
declare r record;
begin
  for r in select id from public.payment_requests where status in ('approved','fully_invoiced') loop
    perform public.sync_payment_request_invoiced_status(r.id);
  end loop;
end $$;

-- 8. Retire the approval / dispute RPCs. Approval is gone; Delete now just soft-deletes the
--    invoice (setting deleted_at) and the trigger reopens the PR if balance frees up.
drop function if exists public.approve_invoice_consume_balance(uuid, uuid, text);
drop function if exists public.dispute_or_delete_invoice_release_balance(uuid, text);
