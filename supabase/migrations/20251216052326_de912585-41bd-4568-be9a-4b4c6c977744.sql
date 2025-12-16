-- ROIBOY Database Schema

-- Enum types
CREATE TYPE public.user_role AS ENUM ('admin', 'leader', 'mentor');
CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'churn_risk', 'churned');
CREATE TYPE public.channel_type AS ENUM ('whatsapp');
CREATE TYPE public.message_source AS ENUM ('whatsapp_text', 'whatsapp_audio_transcript');
CREATE TYPE public.message_direction AS ENUM ('client_to_team', 'team_to_client');
CREATE TYPE public.live_platform AS ENUM ('zoom', 'google_meet');
CREATE TYPE public.interaction_type AS ENUM ('chat', 'qna', 'hand_raise', 'reaction', 'speaking_estimate');
CREATE TYPE public.roi_source AS ENUM ('whatsapp_text', 'whatsapp_audio', 'zoom', 'google_meet', 'manual');
CREATE TYPE public.roi_type AS ENUM ('tangible', 'intangible');
CREATE TYPE public.roi_category AS ENUM ('revenue', 'cost', 'time', 'process', 'clarity', 'confidence', 'tranquility', 'status_direction');
CREATE TYPE public.impact_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.risk_source AS ENUM ('whatsapp_text', 'whatsapp_audio', 'zoom', 'google_meet', 'system');
CREATE TYPE public.quadrant_type AS ENUM ('highE_lowROI', 'lowE_highROI', 'lowE_lowROI', 'highE_highROI');
CREATE TYPE public.trend_type AS ENUM ('up', 'flat', 'down');
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.recommendation_status AS ENUM ('open', 'done', 'dismissed');
CREATE TYPE public.integration_type AS ENUM ('zoom', 'google');
CREATE TYPE public.integration_status AS ENUM ('connected', 'disconnected');

-- Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'mentor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  status client_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, phone_e164)
);

-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  channel channel_type NOT NULL DEFAULT 'whatsapp',
  external_thread_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Message events table
CREATE TABLE public.message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  source message_source NOT NULL,
  direction message_direction NOT NULL,
  content_text TEXT,
  audio_duration_sec INTEGER,
  sent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live sessions table
CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  platform live_platform NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  external_meeting_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance table
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  join_time TIMESTAMPTZ NOT NULL,
  leave_time TIMESTAMPTZ,
  duration_sec INTEGER,
  join_delay_sec INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Live interactions table
CREATE TABLE public.live_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type interaction_type NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ROI events table
CREATE TABLE public.roi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source roi_source NOT NULL,
  roi_type roi_type NOT NULL,
  category roi_category NOT NULL,
  evidence_snippet TEXT,
  impact impact_level NOT NULL DEFAULT 'medium',
  happened_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Risk events table
CREATE TABLE public.risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source risk_source NOT NULL,
  risk_level impact_level NOT NULL DEFAULT 'medium',
  reason TEXT NOT NULL,
  evidence_snippet TEXT,
  happened_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recommendations table
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  action_text TEXT NOT NULL,
  priority priority_level NOT NULL DEFAULT 'medium',
  status recommendation_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Score snapshots table
CREATE TABLE public.score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  roizometer INTEGER NOT NULL DEFAULT 0,
  escore INTEGER NOT NULL DEFAULT 0,
  quadrant quadrant_type NOT NULL DEFAULT 'lowE_lowROI',
  trend trend_type NOT NULL DEFAULT 'flat',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Integrations table
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  type integration_type NOT NULL,
  status integration_status NOT NULL DEFAULT 'disconnected',
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- RLS Policies for accounts
CREATE POLICY "Users can view their account"
  ON public.accounts FOR SELECT
  USING (id = public.get_user_account_id());

-- RLS Policies for users
CREATE POLICY "Users can view users in their account"
  ON public.users FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth_user_id = auth.uid());

-- RLS Policies for clients
CREATE POLICY "Users can view clients in their account"
  ON public.clients FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert clients in their account"
  ON public.clients FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update clients in their account"
  ON public.clients FOR UPDATE
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can delete clients in their account"
  ON public.clients FOR DELETE
  USING (account_id = public.get_user_account_id());

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations in their account"
  ON public.conversations FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert conversations in their account"
  ON public.conversations FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for message_events
CREATE POLICY "Users can view message_events in their account"
  ON public.message_events FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert message_events in their account"
  ON public.message_events FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for live_sessions
CREATE POLICY "Users can view live_sessions in their account"
  ON public.live_sessions FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert live_sessions in their account"
  ON public.live_sessions FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update live_sessions in their account"
  ON public.live_sessions FOR UPDATE
  USING (account_id = public.get_user_account_id());

-- RLS Policies for attendance
CREATE POLICY "Users can view attendance in their account"
  ON public.attendance FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert attendance in their account"
  ON public.attendance FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for live_interactions
CREATE POLICY "Users can view live_interactions in their account"
  ON public.live_interactions FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert live_interactions in their account"
  ON public.live_interactions FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for roi_events
CREATE POLICY "Users can view roi_events in their account"
  ON public.roi_events FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert roi_events in their account"
  ON public.roi_events FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for risk_events
CREATE POLICY "Users can view risk_events in their account"
  ON public.risk_events FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert risk_events in their account"
  ON public.risk_events FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for recommendations
CREATE POLICY "Users can view recommendations in their account"
  ON public.recommendations FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert recommendations in their account"
  ON public.recommendations FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update recommendations in their account"
  ON public.recommendations FOR UPDATE
  USING (account_id = public.get_user_account_id());

-- RLS Policies for score_snapshots
CREATE POLICY "Users can view score_snapshots in their account"
  ON public.score_snapshots FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert score_snapshots in their account"
  ON public.score_snapshots FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

-- RLS Policies for integrations
CREATE POLICY "Users can view integrations in their account"
  ON public.integrations FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert integrations in their account"
  ON public.integrations FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update integrations in their account"
  ON public.integrations FOR UPDATE
  USING (account_id = public.get_user_account_id());

-- Create indexes for better performance
CREATE INDEX idx_users_account_id ON public.users(account_id);
CREATE INDEX idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX idx_clients_account_id ON public.clients(account_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_message_events_client_id ON public.message_events(client_id);
CREATE INDEX idx_message_events_sent_at ON public.message_events(sent_at);
CREATE INDEX idx_roi_events_client_id ON public.roi_events(client_id);
CREATE INDEX idx_roi_events_happened_at ON public.roi_events(happened_at);
CREATE INDEX idx_risk_events_client_id ON public.risk_events(client_id);
CREATE INDEX idx_risk_events_happened_at ON public.risk_events(happened_at);
CREATE INDEX idx_score_snapshots_client_id ON public.score_snapshots(client_id);
CREATE INDEX idx_score_snapshots_computed_at ON public.score_snapshots(computed_at);
CREATE INDEX idx_recommendations_client_id ON public.recommendations(client_id);
CREATE INDEX idx_recommendations_status ON public.recommendations(status);