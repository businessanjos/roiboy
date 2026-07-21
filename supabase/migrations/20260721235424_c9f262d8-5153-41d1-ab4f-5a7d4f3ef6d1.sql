
CREATE TABLE public.mi_market_research (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  query TEXT NOT NULL,
  focus TEXT,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  recency TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mi_market_research_account ON public.mi_market_research(account_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_market_research TO authenticated;
GRANT ALL ON public.mi_market_research TO service_role;
ALTER TABLE public.mi_market_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read market research of their account" ON public.mi_market_research FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users manage market research of their account" ON public.mi_market_research FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
