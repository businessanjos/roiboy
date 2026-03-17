-- Table to store video call sessions
CREATE TABLE public.video_call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id),
  lead_id uuid REFERENCES public.leads(id),
  client_id uuid REFERENCES public.clients(id),
  deal_id uuid REFERENCES public.deals(id),
  daily_room_name text NOT NULL,
  daily_room_url text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  recording_id text,
  recording_url text,
  transcription text,
  analysis text,
  analysis_status text DEFAULT 'pending',
  participant_name text,
  participant_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view video calls from their account"
  ON public.video_call_sessions FOR SELECT
  TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can create video calls in their account"
  ON public.video_call_sessions FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update video calls in their account"
  ON public.video_call_sessions FOR UPDATE
  TO authenticated
  USING (account_id = public.get_my_account_id());

CREATE INDEX idx_video_call_sessions_account ON public.video_call_sessions(account_id);
CREATE INDEX idx_video_call_sessions_user ON public.video_call_sessions(user_id);
CREATE INDEX idx_video_call_sessions_status ON public.video_call_sessions(status);