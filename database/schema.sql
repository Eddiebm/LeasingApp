create table properties (
  id uuid primary key default gen_random_uuid(),
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  rent numeric(10, 2) not null,
  status text default 'active',
  created_at timestamptz default now()
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  dob date not null,
  ssn_last4 text,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties (id) on delete cascade,
  tenant_id uuid references tenants (id) on delete cascade,
  employment text,
  income numeric(10, 2),
  previous_landlord text,
  status text default 'pending',
  credit_score integer,
  background_result jsonb,
  created_at timestamptz default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications (id) on delete cascade,
  type text not null,
  file_url text not null,
  created_at timestamptz default now()
);

