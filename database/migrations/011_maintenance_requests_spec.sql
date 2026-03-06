-- Spec: maintenance_requests with title, urgency, tenant_id, property_id, landlord_id, status (open/in_progress/resolved/closed)
-- Run this after 001 (which created maintenance_requests with category, status 'submitted').

-- Add new columns if missing (e.g. when table was created by 001)
alter table maintenance_requests
  add column if not exists tenant_id uuid references tenants (id) on delete set null,
  add column if not exists property_id uuid references properties (id) on delete set null,
  add column if not exists landlord_id uuid references landlords (id) on delete cascade,
  add column if not exists title text,
  add column if not exists urgency text default 'medium';

-- Backfill title from category or description for existing rows
update maintenance_requests set title = coalesce(title, category, 'Maintenance request') where title is null and (category is not null or description is not null);
update maintenance_requests set title = 'Maintenance request' where title is null;

-- Make title not null after backfill (optional: only if you want strict schema)
-- alter table maintenance_requests alter column title set not null;

-- Allow status values: open, in_progress, resolved, closed (and keep 'submitted' for legacy)
-- Migrate existing 'submitted' to 'open'
update maintenance_requests set status = 'open' where status = 'submitted';

-- Add check for urgency and status if not present (Postgres: drop existing check first if you had one)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'maintenance_requests_urgency_check'
  ) then
    alter table maintenance_requests add constraint maintenance_requests_urgency_check
      check (urgency in ('low', 'medium', 'high'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'maintenance_requests_status_check'
  ) then
    alter table maintenance_requests add constraint maintenance_requests_status_check
      check (status in ('open', 'in_progress', 'resolved', 'closed'));
  end if;
exception
  when others then null; -- ignore if constraints already exist or conflict
end $$;
