
CREATE TABLE public.ops_workload_ai_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  period_label text NOT NULL,
  rows_count integer NOT NULL DEFAULT 0,
  totals jsonb,
  rows_snapshot jsonb,
  gemini_content text,
  gpt_content text,
  gemini_error text,
  gpt_error text,
  models_used jsonb
);

ALTER TABLE public.ops_workload_ai_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ops AI reports"
ON public.ops_workload_ai_reports FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can create ops AI reports"
ON public.ops_workload_ai_reports FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Super admins can delete ops AI reports"
ON public.ops_workload_ai_reports FOR DELETE
TO authenticated
USING (public.is_super_admin());

CREATE INDEX ops_workload_ai_reports_created_at_idx
  ON public.ops_workload_ai_reports (created_at DESC);
