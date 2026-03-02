
-- Table: omie_settings (per-account Omie credentials and config)
CREATE TABLE public.omie_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  app_key TEXT NOT NULL DEFAULT '',
  app_secret TEXT NOT NULL DEFAULT '',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  field_mappings JSONB DEFAULT '{}',
  default_service_code TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE public.omie_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account omie_settings"
  ON public.omie_settings FOR SELECT
  TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can insert own account omie_settings"
  ON public.omie_settings FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update own account omie_settings"
  ON public.omie_settings FOR UPDATE
  TO authenticated
  USING (account_id = public.get_my_account_id());

-- Table: omie_integration_logs (integration attempt history)
CREATE TABLE public.omie_integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  action TEXT NOT NULL DEFAULT 'create_os',
  status TEXT NOT NULL DEFAULT 'error',
  omie_os_id TEXT,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.omie_integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own account omie_integration_logs"
  ON public.omie_integration_logs FOR SELECT
  TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can insert own account omie_integration_logs"
  ON public.omie_integration_logs FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());
