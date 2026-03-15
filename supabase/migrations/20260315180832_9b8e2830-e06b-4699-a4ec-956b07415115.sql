
-- Commission plans table
CREATE TABLE public.commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('weekly', 'biweekly', 'monthly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commission tiers (faixas escalonadas)
CREATE TABLE public.commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  min_value NUMERIC NOT NULL DEFAULT 0,
  max_value NUMERIC,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  is_super_meta BOOLEAN NOT NULL DEFAULT false,
  bonus_value NUMERIC DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commission triggers (gatilhos obrigatórios)
CREATE TABLE public.commission_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('min_calls', 'min_conversion_rate', 'no_delinquency', 'tasks_completed')),
  trigger_value NUMERIC,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Commission periods (weekly snapshots)
CREATE TABLE public.commission_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.commission_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  won_value NUMERIC NOT NULL DEFAULT 0,
  won_deals INTEGER NOT NULL DEFAULT 0,
  total_calls INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC NOT NULL DEFAULT 0,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_total INTEGER NOT NULL DEFAULT 0,
  has_delinquency BOOLEAN NOT NULL DEFAULT false,
  triggers_met JSONB DEFAULT '{}',
  all_triggers_met BOOLEAN NOT NULL DEFAULT false,
  tier_achieved_id UUID REFERENCES public.commission_tiers(id),
  commission_value NUMERIC NOT NULL DEFAULT 0,
  bonus_value NUMERIC NOT NULL DEFAULT 0,
  total_commission NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, user_id, period_start)
);

-- RLS
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_periods ENABLE ROW LEVEL SECURITY;

-- Policies for commission_plans
CREATE POLICY "Users can view own account plans" ON public.commission_plans
  FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can manage own account plans" ON public.commission_plans
  FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id())
  WITH CHECK (account_id = public.get_my_account_id());

-- Policies for commission_tiers
CREATE POLICY "Users can view plan tiers" ON public.commission_tiers
  FOR SELECT TO authenticated
  USING (plan_id IN (SELECT id FROM public.commission_plans WHERE account_id = public.get_my_account_id()));

CREATE POLICY "Users can manage plan tiers" ON public.commission_tiers
  FOR ALL TO authenticated
  USING (plan_id IN (SELECT id FROM public.commission_plans WHERE account_id = public.get_my_account_id()))
  WITH CHECK (plan_id IN (SELECT id FROM public.commission_plans WHERE account_id = public.get_my_account_id()));

-- Policies for commission_triggers
CREATE POLICY "Users can view plan triggers" ON public.commission_triggers
  FOR SELECT TO authenticated
  USING (plan_id IN (SELECT id FROM public.commission_plans WHERE account_id = public.get_my_account_id()));

CREATE POLICY "Users can manage plan triggers" ON public.commission_triggers
  FOR ALL TO authenticated
  USING (plan_id IN (SELECT id FROM public.commission_plans WHERE account_id = public.get_my_account_id()))
  WITH CHECK (plan_id IN (SELECT id FROM public.commission_plans WHERE account_id = public.get_my_account_id()));

-- Policies for commission_periods
CREATE POLICY "Users can view own account periods" ON public.commission_periods
  FOR SELECT TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can manage own account periods" ON public.commission_periods
  FOR ALL TO authenticated
  USING (account_id = public.get_my_account_id())
  WITH CHECK (account_id = public.get_my_account_id());
