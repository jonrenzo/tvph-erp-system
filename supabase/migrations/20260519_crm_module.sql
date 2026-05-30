-- ============================================================================
-- Customer Management Module
-- Tracks customer accounts, contacts, customer projects/jobs, and activities
-- ============================================================================

-- 1) Extend profile roles to support commercial ownership
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role = any (
      array[
        'admin',
        'finance',
        'procurement',
        'project_manager',
        'user',
        'commercial_manager'
      ]
    )
  );

-- 2) crm_accounts
create table if not exists public.crm_accounts (
  id                    uuid primary key default gen_random_uuid(),
  company_name          text not null,
  company_type          text not null default 'prospect'
                        check (company_type = any (array['prospect', 'active_customer', 'inactive_customer'])),
  primary_site_location text,
  industry_note         text,
  notes                 text,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  deleted_at            timestamptz
);
alter table public.crm_accounts enable row level security;

-- 3) crm_contacts
create table if not exists public.crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.crm_accounts(id) on delete cascade,
  full_name   text not null,
  job_title   text,
  email       text,
  phone       text,
  is_primary  boolean default false,
  notes       text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  deleted_at  timestamptz
);
alter table public.crm_contacts enable row level security;

-- 4) crm_opportunities
create table if not exists public.crm_opportunities (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid not null references public.crm_accounts(id),
  contact_id                uuid references public.crm_contacts(id),
  title                     text not null,
  job_type                  text not null
                            check (
                              job_type = any (
                                array[
                                  'underground_mining',
                                  'pole_recovery',
                                  'copper_recovery',
                                  'site_survey',
                                  'inspection_only',
                                  'other'
                                ]
                              )
                            ),
  stage                     text not null default 'prospect'
                            check (
                              stage = any (
                                array[
                                  'prospect',
                                  'site_visit',
                                  'quoted',
                                  'approved',
                                  'ongoing',
                                  'completed',
                                  'lost_cancelled'
                                ]
                              )
                            ),
  status                    text not null default 'open'
                            check (status = any (array['open', 'won', 'lost'])),
  location                  text,
  estimated_contract_value  numeric,
  estimated_copper_volume   numeric,
  expected_start_date       date,
  expected_close_date       date,
  access_requirements       text,
  safety_requirements       text,
  permit_requirements       text,
  next_follow_up_date       date,
  source                    text,
  lost_reason               text,
  owner_id                  uuid references public.profiles(id),
  converted_project_id      uuid references public.projects(id),
  created_by                uuid references public.profiles(id),
  created_at                timestamptz default now(),
  updated_at                timestamptz default now(),
  deleted_at                timestamptz
);
alter table public.crm_opportunities enable row level security;

-- 5) crm_activities
create table if not exists public.crm_activities (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.crm_opportunities(id) on delete cascade,
  activity_type  text not null default 'note'
                 check (
                   activity_type = any (
                     array[
                       'call',
                       'email',
                       'meeting',
                       'site_visit',
                       'task',
                       'note'
                     ]
                   )
                 ),
  subject        text not null,
  details        text,
  activity_date  timestamptz default now(),
  due_date       date,
  is_completed   boolean default false,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz default now()
);
alter table public.crm_activities enable row level security;

-- Explicit API grants for Supabase projects that do not auto-expose new tables.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.crm_accounts to authenticated;
grant select, insert, update, delete on table public.crm_contacts to authenticated;
grant select, insert, update, delete on table public.crm_opportunities to authenticated;
grant select, insert, update, delete on table public.crm_activities to authenticated;

-- ============================================================================
-- INDEXES
-- ============================================================================
create index if not exists idx_crm_contacts_account_id
  on public.crm_contacts(account_id);

create index if not exists idx_crm_opportunities_account_id
  on public.crm_opportunities(account_id);

create index if not exists idx_crm_opportunities_contact_id
  on public.crm_opportunities(contact_id);

create index if not exists idx_crm_opportunities_owner_id
  on public.crm_opportunities(owner_id);

create index if not exists idx_crm_opportunities_stage_status
  on public.crm_opportunities(stage, status)
  where deleted_at is null;

create index if not exists idx_crm_opportunities_follow_up
  on public.crm_opportunities(next_follow_up_date)
  where deleted_at is null;

create index if not exists idx_crm_activities_opportunity_id
  on public.crm_activities(opportunity_id);

create index if not exists idx_crm_accounts_company_name_active
  on public.crm_accounts(company_name)
  where deleted_at is null;

create index if not exists idx_crm_contacts_full_name_active
  on public.crm_contacts(full_name)
  where deleted_at is null;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
drop policy if exists "auth_access_crm_accounts" on public.crm_accounts;
create policy "auth_access_crm_accounts" on public.crm_accounts
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_access_crm_contacts" on public.crm_contacts;
create policy "auth_access_crm_contacts" on public.crm_contacts
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_access_crm_opportunities" on public.crm_opportunities;
create policy "auth_access_crm_opportunities" on public.crm_opportunities
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_access_crm_activities" on public.crm_activities;
create policy "auth_access_crm_activities" on public.crm_activities
  for all to authenticated using (true) with check (true);
