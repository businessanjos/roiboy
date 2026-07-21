
CREATE TABLE public.mi_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  last_scanned_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_competitors TO authenticated;
GRANT ALL ON public.mi_competitors TO service_role;
ALTER TABLE public.mi_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read competitors of their account" ON public.mi_competitors FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Users manage competitors of their account" ON public.mi_competitors FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TABLE public.mi_competitor_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.mi_competitors(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  source_url TEXT,
  markdown TEXT,
  summary TEXT,
  ai_analysis JSONB,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mi_snapshots_competitor ON public.mi_competitor_snapshots(competitor_id, scanned_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_competitor_snapshots TO authenticated;
GRANT ALL ON public.mi_competitor_snapshots TO service_role;
ALTER TABLE public.mi_competitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read snapshots of their account" ON public.mi_competitor_snapshots FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));
CREATE POLICY "Service role writes snapshots" ON public.mi_competitor_snapshots FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER update_mi_competitors_updated_at BEFORE UPDATE ON public.mi_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
