-- Tenant screening + passport tables

create table if not exists tenant_screenings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  application_id uuid references applications (id) on delete set null,
  jurisdiction text,
  provider text,
  status text not null check (status in ('pending', 'in_progress', 'completed', 'failed', 'expired')),
  started_at timestamptz default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  payment_intent_id text,
  amount_cents integer,
  currency text,
  provider_request_id text,
  provider_report_id text,
  error_message text
);

create index if not exists idx_tenant_screenings_tenant_id on tenant_screenings (tenant_id);
create index if not exists idx_tenant_screenings_application_id on tenant_screenings (application_id);
create index if not exists idx_tenant_screenings_status on tenant_screenings (status);

create table if not exists tenant_passports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  identity_verified boolean,
  credit_score integer,
  income_verified boolean,
  eviction_history text,
  criminal_records text,
  right_to_rent text,
  jurisdiction text,
  screening_provider text,
  provider_passport_id text,
  last_screening_id uuid references tenant_screenings (id) on delete set null,
  passport_expiry_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_tenant_passports_tenant_id on tenant_passports (tenant_id);
create index if not exists idx_tenant_passports_expiry on tenant_passports (passport_expiry_date);

create table if not exists screening_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_screening_id uuid not null references tenant_screenings (id) on delete cascade,
  summary jsonb,
  raw_encrypted bytea,
  created_at timestamptz default now()
);

create index if not exists idx_screening_reports_screening_id on screening_reports (tenant_screening_id);

-- Enable RLS and restrict to service role by default.
-- Application code should use the service-role client (getAdminClient/supabaseServer) and
-- enforce per-tenant/per-landlord access in APIs.

alter table tenant_screenings enable row level security;
alter table tenant_passports enable row level security;
alter table screening_reports enable row level security;

create policy if not exists tenant_screenings_service_role_only
  on tenant_screenings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists tenant_passports_service_role_only
  on tenant_passports
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy if not exists screening_reports_service_role_only
  on screening_reports
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

