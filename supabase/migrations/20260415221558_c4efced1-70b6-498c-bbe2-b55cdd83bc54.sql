
-- Quotas por vendedor e produto (mensal)
CREATE TABLE public.sales_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  target_quantity INT DEFAULT 0,
  target_value NUMERIC DEFAULT 0,
  achieved_quantity INT DEFAULT 0,
  achieved_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id, product_id, year, month)
);

ALTER TABLE public.sales_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_quotas_select" ON public.sales_quotas
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "sales_quotas_insert" ON public.sales_quotas
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "sales_quotas_update" ON public.sales_quotas
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "sales_quotas_delete" ON public.sales_quotas
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Plano de incentivo
CREATE TABLE public.sales_incentive_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  period_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly
  bonus_base_value NUMERIC DEFAULT 0, -- valor base do bônus ao atingir 100%
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_incentive_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incentive_plans_select" ON public.sales_incentive_plans
  FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "incentive_plans_insert" ON public.sales_incentive_plans
  FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "incentive_plans_update" ON public.sales_incentive_plans
  FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "incentive_plans_delete" ON public.sales_incentive_plans
  FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- Taxas de comissão por produto
CREATE TABLE public.sales_incentive_product_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.sales_incentive_plans(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  fixed_amount NUMERIC DEFAULT 0, -- valor fixo por venda (opcional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, product_id)
);

ALTER TABLE public.sales_incentive_product_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_rates_select" ON public.sales_incentive_product_rates
  FOR SELECT TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "product_rates_insert" ON public.sales_incentive_product_rates
  FOR INSERT TO authenticated
  WITH CHECK (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "product_rates_update" ON public.sales_incentive_product_rates
  FOR UPDATE TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "product_rates_delete" ON public.sales_incentive_product_rates
  FOR DELETE TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

-- Faixas progressivas de bônus
CREATE TABLE public.sales_incentive_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.sales_incentive_plans(id) ON DELETE CASCADE,
  min_achievement_percent NUMERIC NOT NULL, -- ex: 80
  max_achievement_percent NUMERIC, -- ex: 100 (null = sem limite)
  bonus_multiplier NUMERIC NOT NULL DEFAULT 1, -- multiplicador do bônus base
  label TEXT, -- ex: "Bronze", "Prata", "Ouro"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_incentive_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tiers_select" ON public.sales_incentive_tiers
  FOR SELECT TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "tiers_insert" ON public.sales_incentive_tiers
  FOR INSERT TO authenticated
  WITH CHECK (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "tiers_update" ON public.sales_incentive_tiers
  FOR UPDATE TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

CREATE POLICY "tiers_delete" ON public.sales_incentive_tiers
  FOR DELETE TO authenticated
  USING (plan_id IN (
    SELECT id FROM public.sales_incentive_plans 
    WHERE account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid())
  ));

-- Trigger de updated_at
CREATE TRIGGER update_sales_quotas_updated_at
  BEFORE UPDATE ON public.sales_quotas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_incentive_plans_updated_at
  BEFORE UPDATE ON public.sales_incentive_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
