-- Permite múltiplos planos ativos "team" por conta, desde que com role_label distinto
DROP INDEX IF EXISTS public.cs_incentive_plans_unique_active_per_user;

CREATE UNIQUE INDEX IF NOT EXISTS cs_incentive_plans_unique_active_per_user
  ON public.cs_incentive_plans (
    account_id,
    COALESCE(user_id::text, 'team'),
    COALESCE(role_label, '')
  )
  WHERE is_active = true;