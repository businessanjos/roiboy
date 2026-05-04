
CREATE TABLE IF NOT EXISTS public.client_churn_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  summary TEXT,
  overall_risk TEXT,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  messages_analyzed INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_churn_analyses_client_id_created_at
  ON public.client_churn_analyses (client_id, created_at DESC);

ALTER TABLE public.client_churn_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view churn analyses"
  ON public.client_churn_analyses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert churn analyses"
  ON public.client_churn_analyses FOR INSERT
  TO authenticated
  WITH CHECK (true);
