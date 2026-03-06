-- AI token usage for command center and cost tracking
create table if not exists ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_ai_usage_log_created_at on ai_usage_log (created_at);
create index if not exists idx_ai_usage_log_source on ai_usage_log (source);

comment on table ai_usage_log is 'Log of OpenAI (or other) API token usage per request for admin command center';
