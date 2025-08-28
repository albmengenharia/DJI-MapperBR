-- GeoPilot API - Initial Schema
-- This script sets up the initial database schema for the GeoPilot API
-- using Supabase.

-- 1. PROFILES TABLE
-- Stores user-specific information, including API keys and subscription details.
-- This table is linked to the `auth.users` table provided by Supabase Auth.

create table public.profiles (
  id uuid primary key not null references auth.users(id) on delete cascade,
  api_key text unique not null,
  subscription_tier text not null default 'free',
  api_call_count integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'User profiles, API keys, and subscription information.';
comment on column public.profiles.id is 'Foreign key to auth.users.id';
comment on column public.profiles.api_key is 'The unique API key for programmatic access.';
comment on column public.profiles.subscription_tier is 'The user''s current subscription plan (e.g., free, pro).';
comment on column public.profiles.api_call_count is 'Tracks the number of API calls made by the user.';


-- 2. MISSIONS TABLE
-- Stores the mission calculation requests and results for each user.
-- Multi-tenancy is enforced by the `user_id` column and Row-Level Security.

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'completed',
  request_payload jsonb not null,
  result_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

comment on table public.missions is 'Stores drone mission calculation data.';
comment on column public.missions.user_id is 'Links the mission to the user who created it.';
comment on column public.missions.request_payload is 'The JSON object sent by the user to create the mission.';
comment on column public.missions.result_payload is 'The calculated waypoints and other mission results.';
comment on column public.missions.expires_at is 'Timestamp for when the mission data should be deleted (for retention policies).';


-- 3. ROW-LEVEL SECURITY (RLS)
-- Ensures that users can only access their own data.

-- Enable RLS on the missions table
alter table public.missions enable row level security;

-- Create a policy that allows users to manage their own missions
create policy "Users can manage their own missions"
on public.missions for all
using (auth.uid() = user_id);

comment on policy "Users can manage their own missions" on public.missions is 'This policy ensures that a user can only view, create, update, or delete missions that belong to them.';

-- Enable RLS on the profiles table
alter table public.profiles enable row level security;

-- Create a policy that allows users to view and update their own profile
create policy "Users can manage their own profile"
on public.profiles for all
using (auth.uid() = id);

comment on policy "Users can manage their own profile" on public.profiles is 'This policy ensures that a user can only view or update their own profile information.';
