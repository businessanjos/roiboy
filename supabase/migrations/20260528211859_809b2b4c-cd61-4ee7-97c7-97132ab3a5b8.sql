
-- Marketing Projects: portfolio of strategic initiatives (lançamentos, eventos internacionais, etc.)
CREATE TABLE public.marketing_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning', -- planning, active, launched, completed, on_hold, cancelled
  cover_color TEXT DEFAULT '#8b5cf6',
  cover_emoji TEXT,
  start_date DATE,
  target_date DATE,
  budget_planned NUMERIC(14,2),
  budget_actual NUMERIC(14,2),
  owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_projects_account ON public.marketing_projects(account_id);
CREATE INDEX idx_marketing_projects_status ON public.marketing_projects(status);

CREATE TABLE public.marketing_project_stakeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT,
  role TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'internal', -- internal, external
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mps_project ON public.marketing_project_stakeholders(project_id);

CREATE TABLE public.marketing_project_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mpm_project ON public.marketing_project_milestones(project_id);

CREATE TABLE public.marketing_project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'link', -- link, drive, contract, deck, brief, other
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mpd_project ON public.marketing_project_documents(project_id);

-- Link tables (events & tasks)
CREATE TABLE public.marketing_project_events (
  project_id UUID NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, event_id)
);

CREATE TABLE public.marketing_project_tasks (
  project_id UUID NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.marketing_tasks(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, task_id)
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_projects TO authenticated;
GRANT ALL ON public.marketing_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_project_stakeholders TO authenticated;
GRANT ALL ON public.marketing_project_stakeholders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_project_milestones TO authenticated;
GRANT ALL ON public.marketing_project_milestones TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_project_documents TO authenticated;
GRANT ALL ON public.marketing_project_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_project_events TO authenticated;
GRANT ALL ON public.marketing_project_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_project_tasks TO authenticated;
GRANT ALL ON public.marketing_project_tasks TO service_role;

-- RLS
ALTER TABLE public.marketing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_select" ON public.marketing_projects FOR SELECT
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mp_ins" ON public.marketing_projects FOR INSERT
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mp_upd" ON public.marketing_projects FOR UPDATE
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mp_del" ON public.marketing_projects FOR DELETE
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());

CREATE POLICY "mps_all" ON public.marketing_project_stakeholders FOR ALL
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner())
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mpm_all" ON public.marketing_project_milestones FOR ALL
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner())
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mpd_all" ON public.marketing_project_documents FOR ALL
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner())
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mpe_all" ON public.marketing_project_events FOR ALL
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner())
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());
CREATE POLICY "mpt_all" ON public.marketing_project_tasks FOR ALL
  USING (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner())
  WITH CHECK (account_id = get_my_account_id() OR is_super_admin() OR is_account_owner());

CREATE TRIGGER trg_mp_updated BEFORE UPDATE ON public.marketing_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
