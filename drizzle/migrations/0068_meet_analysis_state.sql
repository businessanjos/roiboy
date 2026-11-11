CREATE TABLE public.meet_analysis_state (
  account_id UUID PRIMARY KEY,
  lease_until TIMESTAMPTZ,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_reason TEXT,
  last_error TEXT,
  last_run_at TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meet_analysis_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.meet_analysis_state TO service_role;