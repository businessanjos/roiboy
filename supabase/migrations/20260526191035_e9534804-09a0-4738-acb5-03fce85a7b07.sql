
-- Chat sessions for Sales Dashboard "Ask the Data"
CREATE TABLE public.sales_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nova conversa',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_chat_sessions TO authenticated;
GRANT ALL ON public.sales_chat_sessions TO service_role;
ALTER TABLE public.sales_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions select" ON public.sales_chat_sessions FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "own sessions insert" ON public.sales_chat_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "own sessions update" ON public.sales_chat_sessions FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "own sessions delete" ON public.sales_chat_sessions FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
CREATE INDEX sales_chat_sessions_user_idx ON public.sales_chat_sessions(auth_user_id, last_message_at DESC);

-- Chat messages
CREATE TABLE public.sales_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sales_chat_sessions(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_chat_messages TO authenticated;
GRANT ALL ON public.sales_chat_messages TO service_role;
ALTER TABLE public.sales_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.sales_chat_messages FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "own messages insert" ON public.sales_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "own messages delete" ON public.sales_chat_messages FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
CREATE INDEX sales_chat_messages_session_idx ON public.sales_chat_messages(session_id, created_at);

-- Pinned KPIs (from chat responses)
CREATE TABLE public.sales_dashboard_pinned_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  auth_user_id uuid NOT NULL,
  label text NOT NULL,
  icon text DEFAULT 'Sparkles',
  color text DEFAULT 'blue',
  unit text,
  question text NOT NULL,
  last_value numeric,
  last_value_text text,
  last_comparison text,
  last_trend text,
  last_computed_at timestamptz,
  is_shared boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_dashboard_pinned_kpis TO authenticated;
GRANT ALL ON public.sales_dashboard_pinned_kpis TO service_role;
ALTER TABLE public.sales_dashboard_pinned_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own or shared kpis" ON public.sales_dashboard_pinned_kpis FOR SELECT TO authenticated USING (auth.uid() = auth_user_id OR is_shared = true);
CREATE POLICY "insert own kpis" ON public.sales_dashboard_pinned_kpis FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "update own kpis" ON public.sales_dashboard_pinned_kpis FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id);
CREATE POLICY "delete own kpis" ON public.sales_dashboard_pinned_kpis FOR DELETE TO authenticated USING (auth.uid() = auth_user_id);
CREATE INDEX sales_pinned_kpis_user_idx ON public.sales_dashboard_pinned_kpis(auth_user_id, position);
