-- Multi-tenancy: landlords, user roles, and RLS

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

-- 5. Enable Row Level Security on core tables
alter table landlords enable row level security;
alter table user_roles enable row level security;
alter table properties enable row level security;
alter table tenants enable row level security;
alter table applications enable row level security;
alter table documents enable row level security;
alter table maintenance_requests enable row level security;
alter table application_status_history enable row level security;
alter table payments enable row level security;

-- Helper predicates (inline in policies):
-- is_admin(): user_roles.role = 'admin'
-- is_landlord(): user_roles.role = 'landlord'
-- is_tenant(): user_roles.role = 'tenant'
-- service role bypass: auth.role() = 'service_role'

-- 6. RLS policies

-- landlords: a landlord sees/updates only their row; admins see all; service_role bypasses via auth.role()
create policy if not exists landlords_admin_all
  on landlords
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists landlords_self
  on landlords
  for all
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'landlord'
    )
    and landlords.user_id = auth.uid()
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'landlord'
    )
    and landlords.user_id = auth.uid()
  );

-- user_roles: a user sees their own role; admins see all; service_role bypass
create policy if not exists user_roles_admin_all
  on user_roles
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists user_roles_self
  on user_roles
  for select
  using (user_roles.user_id = auth.uid());

-- properties: landlord and admin scoped by landlord_id; tenants do not need direct access here.
create policy if not exists properties_admin_all
  on properties
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists properties_by_landlord
  on properties
  for all
  using (
    exists (
      select 1
      from landlords l
      join user_roles ur on ur.user_id = l.user_id and ur.role = 'landlord'
      where l.id = properties.landlord_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from landlords l
      join user_roles ur on ur.user_id = l.user_id and ur.role = 'landlord'
      where l.id = properties.landlord_id and l.user_id = auth.uid()
    )
  );

-- tenants: tenant can see/update their row; landlords can see tenants for their properties; admins see all
create policy if not exists tenants_admin_all
  on tenants
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists tenants_self
  on tenants
  for all
  using (tenants.user_id = auth.uid())
  with check (tenants.user_id = auth.uid());

create policy if not exists tenants_by_landlord
  on tenants
  for select
  using (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      join user_roles ur on ur.user_id = l.user_id and ur.role = 'landlord'
      where a.tenant_id = tenants.id and l.user_id = auth.uid()
    )
  );

-- applications: landlord sees their applications; tenant sees own; admin/service_role see all
create policy if not exists applications_admin_all
  on applications
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists applications_by_landlord
  on applications
  for all
  using (
    exists (
      select 1
      from properties p
      join landlords l on l.id = p.landlord_id
      join user_roles ur on ur.user_id = l.user_id and ur.role = 'landlord'
      where p.id = applications.property_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from properties p
      join landlords l on l.id = p.landlord_id
      join user_roles ur on ur.user_id = l.user_id and ur.role = 'landlord'
      where p.id = applications.property_id and l.user_id = auth.uid()
    )
  );

create policy if not exists applications_by_tenant
  on applications
  for all
  using (
    exists (
      select 1
      from tenants t
      join user_roles ur on ur.user_id = t.user_id and ur.role = 'tenant'
      where t.id = applications.tenant_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from tenants t
      join user_roles ur on ur.user_id = t.user_id and ur.role = 'tenant'
      where t.id = applications.tenant_id and t.user_id = auth.uid()
    )
  );

-- documents: tenant sees own docs; landlord sees docs for their properties; admin/service_role see all
create policy if not exists documents_admin_all
  on documents
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists documents_by_tenant
  on documents
  for all
  using (
    exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      where a.id = documents.application_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      where a.id = documents.application_id and t.user_id = auth.uid()
    )
  );

create policy if not exists documents_by_landlord
  on documents
  for all
  using (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      where a.id = documents.application_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      where a.id = documents.application_id and l.user_id = auth.uid()
    )
  );

-- maintenance_requests: tenant sees own; landlord sees for their properties; admin/service_role see all
create policy if not exists maintenance_admin_all
  on maintenance_requests
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists maintenance_by_tenant
  on maintenance_requests
  for all
  using (
    exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      where a.id = maintenance_requests.application_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      where a.id = maintenance_requests.application_id and t.user_id = auth.uid()
    )
  );

create policy if not exists maintenance_by_landlord
  on maintenance_requests
  for all
  using (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      where a.id = maintenance_requests.application_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      where a.id = maintenance_requests.application_id and l.user_id = auth.uid()
    )
  );

-- application_status_history: align with applications visibility
create policy if not exists status_history_all
  on application_status_history
  for select
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      join user_roles ur on ur.user_id = l.user_id and ur.role = 'landlord'
      where a.id = application_status_history.application_id and l.user_id = auth.uid()
    )
    or exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      join user_roles ur on ur.user_id = t.user_id and ur.role = 'tenant'
      where a.id = application_status_history.application_id and t.user_id = auth.uid()
    )
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

-- payments: tenant sees own; landlord sees for their properties; admin/service_role see all
create policy if not exists payments_admin_all
  on payments
  for all
  using (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

create policy if not exists payments_by_tenant
  on payments
  for all
  using (
    exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      where a.id = payments.application_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from applications a
      join tenants t on t.id = a.tenant_id
      where a.id = payments.application_id and t.user_id = auth.uid()
    )
  );

create policy if not exists payments_by_landlord
  on payments
  for all
  using (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      where a.id = payments.application_id and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from applications a
      join properties p on p.id = a.property_id
      join landlords l on l.id = p.landlord_id
      where a.id = payments.application_id and l.user_id = auth.uid()
    )
  );

