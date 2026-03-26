
ALTER TABLE public.sales_call_analyses
  ADD COLUMN call_outcome text DEFAULT null,
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL DEFAULT null,
  ADD COLUMN outcome_notes text DEFAULT null;

COMMENT ON COLUMN public.sales_call_analyses.call_outcome IS 'Call outcome: success, partial, failure, no_answer, rescheduled';
COMMENT ON COLUMN public.sales_call_analyses.client_id IS 'Link to client for ICP profiling';
COMMENT ON COLUMN public.sales_call_analyses.outcome_notes IS 'Additional notes about the call outcome';
