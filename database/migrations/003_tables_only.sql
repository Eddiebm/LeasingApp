-- Multi-tenancy: tables and columns only (paste this first in Supabase SQL Editor)
-- Run 003_multi_tenancy.sql after for RLS policies, or run the full file at once.

-- 1. Landlords table
create table if not exists landlords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users (id) on delete cascade,
  full_name text not null,
  company_name text,
  email text not null,
  phone text,
  created_at timestamptz default now()
);

-- 2. User roles table
create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'landlord', 'tenant')),
  created_at timestamptz default now()
);

-- 3. Link properties to landlords
alter table properties
  add column if not exists landlord_id uuid references landlords (id);
create index if not exists idx_properties_landlord_id on properties (landlord_id);

-- 4. Link tenants to auth users
alter table tenants
  add column if not exists user_id uuid references auth.users (id);
create index if not exists idx_tenants_user_id on tenants (user_id);
