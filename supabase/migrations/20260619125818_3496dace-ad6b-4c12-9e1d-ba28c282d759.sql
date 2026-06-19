
CREATE TABLE public.lead_duplicate_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  existing_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  existing_lead_name text,
  matched_field text NOT NULL,
  matched_value text,
  payload jsonb,
  auth_method text,
  api_key_id uuid,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_dup_attempts_account_created ON public.lead_duplicate_attempts(account_id, created_at DESC);
CREATE INDEX idx_lead_dup_attempts_existing_lead ON public.lead_duplicate_attempts(existing_lead_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_duplicate_attempts TO authenticated;
GRANT ALL ON public.lead_duplicate_attempts TO service_role;

ALTER TABLE public.lead_duplicate_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view duplicate attempts in their account"
  ON public.lead_duplicate_attempts FOR SELECT
  TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Service role manages duplicate attempts"
  ON public.lead_duplicate_attempts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
