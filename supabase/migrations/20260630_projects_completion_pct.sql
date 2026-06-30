alter table public.projects
  add column if not exists completion_pct numeric(5,2);
