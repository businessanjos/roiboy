-- Tabela de links públicos para a apresentação do plano de incentivo
CREATE TABLE public.incentive_plan_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.sales_incentive_plans(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incentive_plan_share_links_account ON public.incentive_plan_share_links(account_id);
CREATE INDEX idx_incentive_plan_share_links_token ON public.incentive_plan_share_links(token);

ALTER TABLE public.incentive_plan_share_links ENABLE ROW LEVEL SECURITY;

-- Gestores/admins do mesmo account podem gerenciar
CREATE POLICY "share_links_select_same_account"
ON public.incentive_plan_share_links
FOR SELECT TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "share_links_insert_same_account"
ON public.incentive_plan_share_links
FOR INSERT TO authenticated
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "share_links_update_same_account"
ON public.incentive_plan_share_links
FOR UPDATE TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE POLICY "share_links_delete_same_account"
ON public.incentive_plan_share_links
FOR DELETE TO authenticated
USING (
  account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
);

CREATE TRIGGER update_incentive_plan_share_links_updated_at
BEFORE UPDATE ON public.incentive_plan_share_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();