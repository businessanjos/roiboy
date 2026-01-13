-- Create table for user OAuth integrations
CREATE TABLE public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'zoom')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Um usuario so pode ter uma integracao por provedor
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider)
);

-- Create table for OAuth state validation (CSRF protection)
CREATE TABLE public.oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'zoom')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

-- Index for cleaning expired states
CREATE INDEX idx_oauth_states_expires ON public.oauth_states(expires_at);

-- Trigger for updated_at on user_integrations
CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_integrations
CREATE POLICY "Users can view own integrations"
  ON public.user_integrations FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can update own integrations"
  ON public.user_integrations FOR UPDATE
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own integrations"
  ON public.user_integrations FOR DELETE
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));

-- RLS Policies for oauth_states (users can only manage their own states)
CREATE POLICY "Users can view own oauth states"
  ON public.oauth_states FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own oauth states"
  ON public.oauth_states FOR INSERT
  WITH CHECK (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own oauth states"
  ON public.oauth_states FOR DELETE
  USING (user_id IN (
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()
  ));