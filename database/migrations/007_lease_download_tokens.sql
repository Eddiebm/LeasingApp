-- One-time lease download purchases (public tool, no auth)
create table if not exists lease_download_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  lease_text text not null,
  form_json jsonb not null,
  stripe_session_id text,
  created_at timestamptz default now()
);

create index if not exists idx_lease_download_tokens_token on lease_download_tokens (token);
create index if not exists idx_lease_download_tokens_created_at on lease_download_tokens (created_at);
