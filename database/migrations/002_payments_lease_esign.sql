-- Payments (Stripe) + lease e-sign

alter table applications
  add column if not exists lease_signed_at timestamptz,
  add column if not exists lease_signed_pdf_url text,
  add column if not exists lease_sign_token text;
create index if not exists idx_applications_lease_sign_token on applications (lease_sign_token) where lease_sign_token is not null;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications (id) on delete cascade,
  amount_cents integer not null,
  stripe_payment_intent_id text,
  status text default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_payments_application_id on payments (application_id);
create index if not exists idx_payments_stripe_id on payments (stripe_payment_intent_id);
