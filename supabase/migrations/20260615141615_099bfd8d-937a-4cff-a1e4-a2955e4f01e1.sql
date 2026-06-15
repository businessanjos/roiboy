
ALTER TABLE public.tech_projects
  ADD COLUMN IF NOT EXISTS metrics_endpoint text,
  ADD COLUMN IF NOT EXISTS metrics_token_secret_name text;

ALTER TABLE public.tech_project_snapshots
  ADD COLUMN IF NOT EXISTS ai_tokens_30d bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_cents_30d bigint NOT NULL DEFAULT 0;
