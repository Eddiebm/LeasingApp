-- Distinguish payment purpose (screening fee vs rent/deposit)

alter table payments
  add column if not exists payment_type text;

comment on column payments.payment_type is 'e.g. screening_fee, rent, deposit';
