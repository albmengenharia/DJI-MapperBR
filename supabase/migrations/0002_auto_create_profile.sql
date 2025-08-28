-- This migration creates a trigger that automatically creates a user profile
-- in public.profiles when a new user signs up in auth.users.

-- First, ensure the uuid-ossp extension is enabled, as it provides uuid_generate_v4().
-- This is usually enabled by default in Supabase projects.
create extension if not exists "uuid-ossp" with schema extensions;

-- 1. Create the trigger function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Insert a new profile record for the new user.
  -- The api_key is generated using a prefixed, URL-safe UUID.
  insert into public.profiles (id, api_key)
  values (
    new.id,
    'gp_' || replace(extensions.uuid_generate_v4()::text, '-', '')
  );
  return new;
end;
$$;

-- 2. Create the trigger
-- This trigger fires after a new user is created in the auth.users table.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

comment on function public.handle_new_user is 'Creates a new user profile upon registration.';
comment on trigger on_auth_user_created on auth.users is 'Automatically creates a profile when a new user signs up.';
