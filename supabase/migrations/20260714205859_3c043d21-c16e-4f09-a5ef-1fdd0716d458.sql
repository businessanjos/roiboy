
-- Clinicas do cliente
CREATE TABLE public.client_clinics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_clinics TO authenticated;
GRANT ALL ON public.client_clinics TO service_role;
ALTER TABLE public.client_clinics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinicas_select" ON public.client_clinics FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "clinicas_insert" ON public.client_clinics FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "clinicas_update" ON public.client_clinics FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "clinicas_delete" ON public.client_clinics FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_client_clinics_client ON public.client_clinics(client_id);

-- Meta mensal por clinica
CREATE TABLE public.client_clinic_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.client_clinics(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  goal_amount NUMERIC NOT NULL DEFAULT 0,
  actual_amount NUMERIC,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_clinic_goals TO authenticated;
GRANT ALL ON public.client_clinic_goals TO service_role;
ALTER TABLE public.client_clinic_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_goals_select" ON public.client_clinic_goals FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "clinic_goals_insert" ON public.client_clinic_goals FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "clinic_goals_update" ON public.client_clinic_goals FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "clinic_goals_delete" ON public.client_clinic_goals FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX idx_clinic_goals_clinic ON public.client_clinic_goals(clinic_id);
CREATE INDEX idx_clinic_goals_month ON public.client_clinic_goals(client_id, month);

-- Triggers de updated_at
CREATE TRIGGER trg_client_clinics_updated
  BEFORE UPDATE ON public.client_clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_client_clinic_goals_updated
  BEFORE UPDATE ON public.client_clinic_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
