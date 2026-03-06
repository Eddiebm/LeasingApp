-- Digital lease signing: token-based e-sign flow per document

alter table documents
  add column if not exists signing_token text unique,
  add column if not exists signing_token_expires_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by_name text,
  add column if not exists signed_by_ip text,
  add column if not exists signed_by_user_agent text,
  add column if not exists document_hash text,
  add column if not exists signed_pdf_url text,
  add column if not exists tenant_email text,
  add column if not exists document_content text;

create index if not exists idx_documents_signing_token on documents (signing_token) where signing_token is not null;
