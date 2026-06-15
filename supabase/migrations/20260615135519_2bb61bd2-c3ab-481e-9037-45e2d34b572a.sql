
-- TECH PROJECTS
CREATE TABLE public.tech_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  platform text NOT NULL DEFAULT 'Lovable',
  plan text,
  url text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  color text DEFAULT '#6366f1',
  monthly_cost_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  stripe_secret_name text,
  stripe_account_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_projects TO authenticated;
GRANT ALL ON public.tech_projects TO service_role;

ALTER TABLE public.tech_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_projects select by account"
ON public.tech_projects FOR SELECT TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "tech_projects insert by account admin"
ON public.tech_projects FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid())
  AND public.is_account_owner()
);

CREATE POLICY "tech_projects update by account admin"
ON public.tech_projects FOR UPDATE TO authenticated
USING (
  account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid())
  AND public.is_account_owner()
);

CREATE POLICY "tech_projects delete by account admin"
ON public.tech_projects FOR DELETE TO authenticated
USING (
  account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid())
  AND public.is_account_owner()
);

CREATE OR REPLACE FUNCTION public.tech_projects_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tech_projects_updated
BEFORE UPDATE ON public.tech_projects
FOR EACH ROW EXECUTE FUNCTION public.tech_projects_set_updated_at();

-- SNAPSHOTS
CREATE TABLE public.tech_project_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.tech_projects(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  mrr_cents bigint NOT NULL DEFAULT 0,
  arr_cents bigint NOT NULL DEFAULT 0,
  active_subscriptions int NOT NULL DEFAULT 0,
  new_subscriptions int NOT NULL DEFAULT 0,
  churned_subscriptions int NOT NULL DEFAULT 0,
  revenue_last_30d_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  source text NOT NULL DEFAULT 'manual',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, snapshot_date, source)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_project_snapshots TO authenticated;
GRANT ALL ON public.tech_project_snapshots TO service_role;

ALTER TABLE public.tech_project_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tech_snapshots select by account"
ON public.tech_project_snapshots FOR SELECT TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "tech_snapshots insert by account admin"
ON public.tech_project_snapshots FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid())
  AND public.is_account_owner()
);

CREATE POLICY "tech_snapshots update by account admin"
ON public.tech_project_snapshots FOR UPDATE TO authenticated
USING (
  account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid())
  AND public.is_account_owner()
);

CREATE POLICY "tech_snapshots delete by account admin"
ON public.tech_project_snapshots FOR DELETE TO authenticated
USING (
  account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid())
  AND public.is_account_owner()
);

CREATE INDEX idx_tech_snapshots_project_date ON public.tech_project_snapshots(project_id, snapshot_date DESC);
CREATE INDEX idx_tech_snapshots_account ON public.tech_project_snapshots(account_id);
