alter table public.po_penalties
  alter column first_overdue_on drop not null,
  alter column last_calculated_on drop not null;
