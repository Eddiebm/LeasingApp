-- One-time document downloads from /documents chat (lease or eviction)
create table if not exists document_download_tokens (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  document_text text not null,
  document_type text not null,
  stripe_session_id text,
  created_at timestamptz default now()
);

create index if not exists idx_document_download_tokens_token on document_download_tokens (token);
