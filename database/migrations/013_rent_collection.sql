-- Stripe Connect on landlords
alter table landlords
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_onboarded boolean default false,
  add column if not exists stripe_connect_charges_enabled boolean default false,
  add column if not exists stripe_connect_payouts_enabled boolean default false;

-- Rent schedules
create table if not exists rent_schedules (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references landlords(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'usd',
  due_day_of_month integer not null default 1,
  late_fee_cents integer default 5000,
  late_fee_grace_days integer default 5,
  is_active boolean default true,
  autopay_enabled boolean default false,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Rent payments
create table if not exists rent_payments (
  id uuid primary key default gen_random_uuid(),
  rent_schedule_id uuid references rent_schedules(id) on delete set null,
  landlord_id uuid not null references landlords(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  amount_cents integer not null,
  late_fee_cents integer default 0,
  platform_fee_cents integer default 0,
  currency text not null default 'usd',
  payment_method text check (payment_method in ('card', 'ach')),
  status text not null check (status in ('pending', 'processing', 'succeeded', 'failed', 'refunded')) default 'pending',
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  due_date date,
  paid_at timestamptz,
  period_start date,
  period_end date,
  notes text,
  created_at timestamptz default now()
);

-- Autopay mandates
create table if not exists autopay_mandates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  rent_schedule_id uuid not null references rent_schedules(id) on delete cascade,
  stripe_customer_id text,
  stripe_payment_method_id text,
  payment_method text check (payment_method in ('card', 'ach')),
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table rent_schedules enable row level security;
alter table rent_payments enable row level security;
alter table autopay_mandates enable row level security;

create index if not exists idx_rent_schedules_landlord on rent_schedules (landlord_id);
create index if not exists idx_rent_schedules_property on rent_schedules (property_id);
create index if not exists idx_rent_payments_schedule on rent_payments (rent_schedule_id);
create index if not exists idx_rent_payments_stripe on rent_payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
