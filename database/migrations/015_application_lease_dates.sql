-- Lease term dates for command center (expiring-by-month) and tenant portal
alter table applications
  add column if not exists lease_start_at date,
  add column if not exists lease_end_at date;

create index if not exists idx_applications_lease_end_at on applications (lease_end_at) where lease_end_at is not null;
create index if not exists idx_applications_lease_signed_at on applications (lease_signed_at) where lease_signed_at is not null;

comment on column applications.lease_start_at is 'Lease term start (from signed lease or landlord).';
comment on column applications.lease_end_at is 'Lease term end; used for expiring-by-month in command center.';
