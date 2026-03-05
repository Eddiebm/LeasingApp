-- SaaS billing fields on landlords

alter table landlords
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_plan text,
  add column if not exists subscription_status text default 'inactive',
  add column if not exists subscription_current_period_end timestamptz;

create index if not exists idx_landlords_stripe_customer_id on landlords (stripe_customer_id);

