-- ============================================================================
-- Migration 0003: Fix handle_new_auth_user trigger
--
-- Symptom: Supabase Dashboard -> Authentication -> Users -> "Create user"
-- fails with "Database error creating new user".
--
-- Root cause: the original trigger (from 0001_init.sql) ran as a plain
-- SECURITY DEFINER function without an explicit search_path, and had no
-- protection against a duplicate email already sitting in public.users
-- (e.g. left over from an earlier failed attempt). Either condition makes
-- the INSERT inside the trigger throw, and because the trigger runs
-- *inside* the same transaction as the auth.users insert, Postgres rolls
-- back the whole signup — so no auth user gets created at all.
--
-- Fix: pin the search_path, upsert on email instead of a bare insert, and
-- wrap the body in an exception handler so that even if something
-- unexpected happens, account creation in auth.users is never blocked by
-- a problem in our mirror table. (You can always add a missing profile row
-- manually afterward from the Users page or SQL editor.)
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    (case when (select count(*) from public.users) = 0 then 'admin' else 'staff' end)::user_role
  )
  on conflict (email) do update
    set id = excluded.id,
        updated_at = now();
  return new;
exception when others then
  -- Never let a problem in our profile table block Supabase Auth from
  -- creating the account. Surface a warning in the Postgres logs instead.
  raise warning 'handle_new_auth_user: could not sync profile for % (%): %', new.email, new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- One-off cleanup: if you already have auth.users accounts that never got a
-- matching public.users row (because they were created while the old, buggy
-- trigger was in place), this backfills them. Safe to run any time.
-- ----------------------------------------------------------------------------
insert into public.users (id, name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  (case when (select count(*) from public.users) = 0 then 'admin' else 'staff' end)::user_role
from auth.users u
left join public.users pu on pu.id = u.id
where pu.id is null
on conflict (email) do update set id = excluded.id, updated_at = now();
