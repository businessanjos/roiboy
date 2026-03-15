
-- Table to log 3C Plus call events for metrics and reporting
CREATE TABLE public.threecplus_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  call_id text,
  call_type text NOT NULL DEFAULT 'manual', -- 'manual', 'dialer', 'receptive'
  direction text NOT NULL DEFAULT 'outbound', -- 'outbound', 'inbound'
  phone text,
  contact_name text,
  campaign_id text,
  campaign_name text,
  status text NOT NULL DEFAULT 'created', -- 'created', 'ringing', 'connected', 'hangup', 'finished', 'failed', 'abandoned', 'unanswered'
  qualification text,
  qualification_name text,
  duration_seconds integer DEFAULT 0,
  acw_seconds integer DEFAULT 0, -- After Call Work / TPA
  wait_seconds integer DEFAULT 0,
  started_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  metadata jsonb DEFAULT '{}',
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_threecplus_call_logs_account ON public.threecplus_call_logs(account_id);
CREATE INDEX idx_threecplus_call_logs_user ON public.threecplus_call_logs(user_id);
CREATE INDEX idx_threecplus_call_logs_started ON public.threecplus_call_logs(started_at);
CREATE INDEX idx_threecplus_call_logs_call_id ON public.threecplus_call_logs(call_id);

-- Table to track agent sessions (login/logout, pauses)
CREATE TABLE public.threecplus_agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id text,
  campaign_name text,
  session_type text NOT NULL DEFAULT 'login', -- 'login', 'pause'
  pause_name text,
  status text NOT NULL DEFAULT 'active', -- 'active', 'ended'
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_threecplus_agent_sessions_account ON public.threecplus_agent_sessions(account_id);
CREATE INDEX idx_threecplus_agent_sessions_user ON public.threecplus_agent_sessions(user_id);
CREATE INDEX idx_threecplus_agent_sessions_started ON public.threecplus_agent_sessions(started_at);

-- RLS Policies
ALTER TABLE public.threecplus_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threecplus_agent_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see call logs from their account
CREATE POLICY "Users can view own account call logs" ON public.threecplus_call_logs
  FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

-- Users can insert their own call logs
CREATE POLICY "Users can insert own call logs" ON public.threecplus_call_logs
  FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id() AND user_id = public.get_current_user_id());

-- Users can update their own call logs
CREATE POLICY "Users can update own call logs" ON public.threecplus_call_logs
  FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND user_id = public.get_current_user_id());

-- Agent sessions policies
CREATE POLICY "Users can view own account sessions" ON public.threecplus_agent_sessions
  FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can insert own sessions" ON public.threecplus_agent_sessions
  FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id() AND user_id = public.get_current_user_id());

CREATE POLICY "Users can update own sessions" ON public.threecplus_agent_sessions
  FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id() AND user_id = public.get_current_user_id());

-- Enable realtime for call logs (for live dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.threecplus_call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.threecplus_agent_sessions;
