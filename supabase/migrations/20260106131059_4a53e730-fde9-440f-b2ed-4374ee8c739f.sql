-- Create table for AI suggestion feedback (segmented by sector)
CREATE TABLE public.ai_suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.zapp_conversations(id) ON DELETE SET NULL,
  
  -- Suggestion context
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('correction', 'reply')),
  original_text TEXT,
  suggested_text TEXT NOT NULL,
  context_messages JSONB,
  
  -- User feedback
  feedback TEXT NOT NULL CHECK (feedback IN ('positive', 'negative')),
  was_used BOOLEAN DEFAULT FALSE,
  edited_before_send BOOLEAN,
  final_text_sent TEXT,
  
  -- Outcome tracking (filled later)
  client_responded BOOLEAN,
  response_time_minutes INTEGER,
  client_sentiment TEXT CHECK (client_sentiment IN ('positive', 'neutral', 'negative')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create table for effective communication patterns (segmented by sector)
CREATE TABLE public.ai_effective_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL,
  
  -- Pattern context
  pattern_type TEXT NOT NULL,
  trigger_context TEXT,
  effective_response TEXT NOT NULL,
  why_it_works TEXT,
  
  -- Success metrics
  success_score NUMERIC DEFAULT 0 CHECK (success_score >= 0 AND success_score <= 100),
  times_used INTEGER DEFAULT 0,
  positive_outcomes INTEGER DEFAULT 0,
  
  -- Source tracking
  source_conversation_id UUID REFERENCES public.zapp_conversations(id) ON DELETE SET NULL,
  source_message_id UUID,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  reviewed_by UUID,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ai_suggestion_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_effective_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_suggestion_feedback
CREATE POLICY "Users can view their account feedback"
  ON public.ai_suggestion_feedback FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert feedback for their account"
  ON public.ai_suggestion_feedback FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- RLS policies for ai_effective_patterns
CREATE POLICY "Users can view their account patterns"
  ON public.ai_effective_patterns FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their account patterns"
  ON public.ai_effective_patterns FOR ALL
  USING (account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_ai_feedback_account_sector ON public.ai_suggestion_feedback(account_id, sector_id);
CREATE INDEX idx_ai_feedback_conversation ON public.ai_suggestion_feedback(conversation_id);
CREATE INDEX idx_ai_feedback_created ON public.ai_suggestion_feedback(created_at DESC);

CREATE INDEX idx_ai_patterns_account_sector ON public.ai_effective_patterns(account_id, sector_id);
CREATE INDEX idx_ai_patterns_active ON public.ai_effective_patterns(account_id, sector_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_ai_patterns_score ON public.ai_effective_patterns(success_score DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_ai_effective_patterns_updated_at
  BEFORE UPDATE ON public.ai_effective_patterns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();