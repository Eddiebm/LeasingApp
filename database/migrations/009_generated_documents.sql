-- Store AI-generated documents for preview + pay-to-download
create table if not exists generated_documents (
  id uuid primary key,
  document_type text not null,
  jurisdiction text,
  document_text text not null,
  paid boolean default false,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists idx_generated_documents_expires_at on generated_documents (expires_at);
