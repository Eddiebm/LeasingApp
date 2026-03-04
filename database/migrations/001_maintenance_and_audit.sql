-- Maintenance requests + application audit/litigation fields

alter table properties
  add column if not exists application_deadline date;

alter table applications
  add column if not exists application_snapshot jsonb,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists signature text,
  add column if not exists current_address text,
  add column if not exists reason_for_leaving text,
  add column if not exists monthly_rent text,
  add column if not exists years_employed text,
  add column if not exists credit_consent boolean default false,
  add column if not exists background_consent boolean default false;

create table if not exists application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz default now(),
  changed_by text
);
create index if not exists idx_status_history_application_id on application_status_history (application_id);

create table if not exists maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  category text not null,
  description text not null,
  photo_url text,
  status text default 'submitted',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_maintenance_application_id on maintenance_requests (application_id);
create index if not exists idx_maintenance_status on maintenance_requests (status);
