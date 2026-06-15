
ALTER TABLE public.tech_project_snapshots
  ADD COLUMN IF NOT EXISTS revenue_last_month_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_current_month_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_messages_30d bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trialing_subscriptions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS past_due_subscriptions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_new_subscriptions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_month_label text;
