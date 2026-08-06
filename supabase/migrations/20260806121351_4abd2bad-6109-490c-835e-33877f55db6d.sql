
ALTER TABLE public.mi_competitors
  ADD COLUMN IF NOT EXISTS previous_tier text,
  ADD COLUMN IF NOT EXISTS tier_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS ticket_min numeric,
  ADD COLUMN IF NOT EXISTS ticket_max numeric;

CREATE OR REPLACE FUNCTION public.mi_tier_ticket_range(_tier text)
RETURNS numeric[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_tier, ''))
    WHEN 'bronze' THEN ARRAY[60000, 119000]::numeric[]
    WHEN 'silver' THEN ARRAY[120000, 199000]::numeric[]
    WHEN 'prata' THEN ARRAY[120000, 199000]::numeric[]
    WHEN 'gold' THEN ARRAY[200000, 399000]::numeric[]
    WHEN 'ouro' THEN ARRAY[200000, 399000]::numeric[]
    WHEN 'platinum' THEN ARRAY[400000, NULL]::numeric[]
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.mi_competitors_apply_ticket_range()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r numeric[];
BEGIN
  r := public.mi_tier_ticket_range(NEW.tier);
  NEW.ticket_min := r[1];
  NEW.ticket_max := r[2];
  IF TG_OP = 'UPDATE' AND coalesce(OLD.tier,'') IS DISTINCT FROM coalesce(NEW.tier,'') THEN
    NEW.previous_tier := OLD.tier;
    NEW.tier_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mi_competitors_ticket_range ON public.mi_competitors;
CREATE TRIGGER mi_competitors_ticket_range
BEFORE INSERT OR UPDATE ON public.mi_competitors
FOR EACH ROW EXECUTE FUNCTION public.mi_competitors_apply_ticket_range();

UPDATE public.mi_competitors SET tier = tier WHERE tier IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.mi_competitor_sync_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE,
  source_url text NOT NULL,
  auto_enabled boolean NOT NULL DEFAULT true,
  interval_days integer NOT NULL DEFAULT 30,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_competitor_sync_config TO authenticated;
GRANT ALL ON public.mi_competitor_sync_config TO service_role;
ALTER TABLE public.mi_competitor_sync_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage sync config of their account"
ON public.mi_competitor_sync_config FOR ALL TO authenticated
USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));

CREATE TRIGGER update_mi_competitor_sync_config_updated_at
BEFORE UPDATE ON public.mi_competitor_sync_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.mi_competitor_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  source_url text,
  status text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'manual',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  clubs_found integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  tier_changed_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mi_sync_runs_account_started ON public.mi_competitor_sync_runs(account_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_competitor_sync_runs TO authenticated;
GRANT ALL ON public.mi_competitor_sync_runs TO service_role;
ALTER TABLE public.mi_competitor_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read sync runs of their account"
ON public.mi_competitor_sync_runs FOR SELECT TO authenticated
USING (account_id IN (SELECT users.account_id FROM public.users WHERE users.auth_user_id = auth.uid()));

CREATE TRIGGER update_mi_competitor_sync_runs_updated_at
BEFORE UPDATE ON public.mi_competitor_sync_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
