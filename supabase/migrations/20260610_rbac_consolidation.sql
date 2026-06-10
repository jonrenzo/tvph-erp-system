-- ============================================================================
-- RBAC consolidation: 7 roles -> 5
--   superadmin (devs), admin (director), finance, operations, viewer
-- ============================================================================

-- 1. Drop the old role CHECK so we can remap existing rows.
alter table public.profiles drop constraint if exists profiles_role_check;

-- 2. Remap legacy roles to the new set. `admin` is intentionally kept as `admin`
--    (directors stay directors) so the currently-deployed app keeps working; the
--    dev `superadmin` account(s) are bootstrapped separately. Single CASE so there
--    is no cascade between mappings.
update public.profiles set role = case role
  when 'executive'          then 'admin'
  when 'procurement'        then 'operations'
  when 'project_manager'    then 'operations'
  when 'commercial_manager' then 'operations'
  when 'user'               then 'viewer'
  else role -- admin and finance stay
end;

-- 3. New constraint.
alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['superadmin', 'admin', 'finance', 'operations', 'viewer']));

-- 4. Redefine RBAC helper functions (all RLS policies delegate to these).
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
declare user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role in ('superadmin', 'admin');
end;
$$ language plpgsql security definer;

create or replace function public.is_staff(user_id uuid)
returns boolean as $$
declare user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role in ('superadmin', 'admin', 'finance', 'operations');
end;
$$ language plpgsql security definer;

create or replace function public.is_superadmin(user_id uuid)
returns boolean as $$
declare user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role = 'superadmin';
end;
$$ language plpgsql security definer;
