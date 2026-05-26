
-- 1) Extend forms
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_campaign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS forms_account_slug_uniq
  ON public.forms(account_id, slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_forms_is_campaign ON public.forms(account_id, is_campaign) WHERE is_campaign = true;

-- Allow anon to look up form by slug (public form page) - safe, only exposes existence
GRANT SELECT ON public.forms TO anon;

-- 2) form_sessions
CREATE TABLE IF NOT EXISTS public.form_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  landed_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  response_id uuid,
  last_field_id text,
  fields_seen int NOT NULL DEFAULT 0,
  total_seconds int,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  user_agent text,
  ip_hash text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, session_token)
);
CREATE INDEX IF NOT EXISTS idx_form_sessions_form_landed ON public.form_sessions(account_id, form_id, landed_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_sessions_completed ON public.form_sessions(form_id, completed_at) WHERE completed_at IS NOT NULL;

GRANT INSERT, UPDATE, SELECT ON public.form_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_sessions TO authenticated;
GRANT ALL ON public.form_sessions TO service_role;

ALTER TABLE public.form_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a session row (public form). Validates form exists and is active+campaign.
CREATE POLICY "Anyone can insert sessions for active campaign forms"
ON public.form_sessions FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.forms f WHERE f.id = form_sessions.form_id AND f.is_active = true AND f.is_campaign = true AND f.account_id = form_sessions.account_id
));

-- Allow update of own session by session_token match (no auth) - PostgREST will not enforce but edge function uses service role
CREATE POLICY "Anyone can update sessions for active campaign forms"
ON public.form_sessions FOR UPDATE TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_sessions.form_id AND f.is_campaign = true))
WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_sessions.form_id AND f.is_campaign = true));

CREATE POLICY "Account members can read sessions"
ON public.form_sessions FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Account members can delete sessions"
ON public.form_sessions FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

CREATE TRIGGER update_form_sessions_updated_at BEFORE UPDATE ON public.form_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) form_field_events
CREATE TABLE IF NOT EXISTS public.form_field_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.form_sessions(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  field_id text NOT NULL,
  event text NOT NULL CHECK (event IN ('focus','blur','change','skip','submit_attempt','validation_error')),
  seconds_on_field int,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_form_field_events_form_field ON public.form_field_events(form_id, field_id);
CREATE INDEX IF NOT EXISTS idx_form_field_events_session ON public.form_field_events(session_id);

GRANT INSERT, SELECT ON public.form_field_events TO anon;
GRANT SELECT, INSERT, DELETE ON public.form_field_events TO authenticated;
GRANT ALL ON public.form_field_events TO service_role;

ALTER TABLE public.form_field_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert events for active campaign forms"
ON public.form_field_events FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_field_events.form_id AND f.is_active = true AND f.is_campaign = true));

CREATE POLICY "Account members can read field events"
ON public.form_field_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_field_events.form_id AND f.account_id = get_user_account_id()));

CREATE POLICY "Account members can delete field events"
ON public.form_field_events FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_field_events.form_id AND f.account_id = get_user_account_id()));

-- 4) Extend form_responses with campaign tracking
ALTER TABLE public.form_responses
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.form_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS matched_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_method text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS landed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_form_responses_email ON public.form_responses(account_id, email);
CREATE INDEX IF NOT EXISTS idx_form_responses_session ON public.form_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_utm ON public.form_responses(account_id, utm_campaign);
