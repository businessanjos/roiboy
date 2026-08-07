ALTER TABLE public.traffic_agencies
  ADD COLUMN IF NOT EXISTS public_report_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS traffic_agencies_public_report_token_key
  ON public.traffic_agencies (public_report_token);

ALTER TABLE public.agency_weekly_reports
  ADD COLUMN IF NOT EXISTS submitted_via_public_link boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_by_name text;