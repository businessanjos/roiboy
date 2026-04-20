
-- ===== FASE 4: Banco de Hooks =====
CREATE TABLE public.marketing_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  category TEXT, -- 'curiosidade','promessa','polemica','historia','dado','provocacao','outro'
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual','instagram','tiktok','youtube','trend','ai'
  source_post_id TEXT, -- id externo (instagram_id, tiktok_id, youtube_id)
  source_platform TEXT, -- 'instagram','tiktok','youtube'
  source_url TEXT,
  performance_score NUMERIC(6,2) DEFAULT 0, -- 0-100, calculado vs média
  views BIGINT DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  is_favorite BOOLEAN DEFAULT false,
  created_by_ai BOOLEAN DEFAULT false,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_hooks_account ON public.marketing_hooks(account_id);
CREATE INDEX idx_marketing_hooks_score ON public.marketing_hooks(account_id, performance_score DESC);
CREATE INDEX idx_marketing_hooks_category ON public.marketing_hooks(account_id, category);

ALTER TABLE public.marketing_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage hooks"
  ON public.marketing_hooks FOR ALL
  USING (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()));

-- ===== FASE 4: Performance Insights =====
CREATE TABLE public.marketing_performance_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'instagram','tiktok','youtube','combined'
  insight_type TEXT NOT NULL, -- 'top_format','best_time','winning_hook','hashtag_pattern','content_pattern'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  score NUMERIC(5,2) DEFAULT 0,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_perf_insights_account ON public.marketing_performance_insights(account_id, created_at DESC);

ALTER TABLE public.marketing_performance_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members view insights"
  ON public.marketing_performance_insights FOR ALL
  USING (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()));

-- ===== FASE 3: Copilot Conversations =====
CREATE TABLE public.marketing_copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_conv_account ON public.marketing_copilot_conversations(account_id, last_message_at DESC);

ALTER TABLE public.marketing_copilot_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage copilot conversations"
  ON public.marketing_copilot_conversations FOR ALL
  USING (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()));

CREATE TABLE public.marketing_copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.marketing_copilot_conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user','assistant','tool'
  content TEXT,
  tool_calls JSONB,
  tool_call_id TEXT,
  tool_name TEXT,
  tool_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_msgs_conv ON public.marketing_copilot_messages(conversation_id, created_at);

ALTER TABLE public.marketing_copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage copilot messages"
  ON public.marketing_copilot_messages FOR ALL
  USING (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE auth_user_id = auth.uid()));

-- Trigger updated_at em hooks e conversations
CREATE TRIGGER trg_marketing_hooks_updated
  BEFORE UPDATE ON public.marketing_hooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_copilot_conv_updated
  BEFORE UPDATE ON public.marketing_copilot_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
