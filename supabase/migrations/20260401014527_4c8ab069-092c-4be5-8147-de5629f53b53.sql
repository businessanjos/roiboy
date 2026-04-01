CREATE TABLE public.churn_analysis_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  insights TEXT NOT NULL,
  contracts_analyzed INTEGER DEFAULT 0,
  clients_with_messages INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_value NUMERIC DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.churn_analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view churn reports for their account"
  ON public.churn_analysis_reports
  FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert churn reports for their account"
  ON public.churn_analysis_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));