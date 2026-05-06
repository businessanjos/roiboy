CREATE TABLE public.meta_budget_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  ad_account_id TEXT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign','adset','ad')),
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  budget_type TEXT NOT NULL DEFAULT 'daily' CHECK (budget_type IN ('daily','lifetime')),
  previous_value NUMERIC,
  new_value NUMERIC,
  currency TEXT DEFAULT 'BRL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mbh_entity ON public.meta_budget_history (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_mbh_account ON public.meta_budget_history (account_id, created_at DESC);

ALTER TABLE public.meta_budget_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view budget history of their account"
ON public.meta_budget_history
FOR SELECT
TO authenticated
USING (
  account_id IS NULL
  OR account_id IN (
    SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can insert their own budget history"
ON public.meta_budget_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
