-- Create table for default feedback questions at account level
CREATE TABLE public.feedback_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'text', -- 'nps', 'stars', 'yes_no', 'text', 'textarea'
  question_text text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT true, -- true = account default, false = event-specific
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for event-specific feedback questions (overrides)
CREATE TABLE public.event_feedback_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'text', -- 'nps', 'stars', 'yes_no', 'text', 'textarea'
  question_text text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table to store custom question responses
CREATE TABLE public.event_feedback_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL REFERENCES public.event_feedback(id) ON DELETE CASCADE,
  question_id uuid NOT NULL, -- Can reference either feedback_questions or event_feedback_questions
  question_text text NOT NULL, -- Store the question text for historical reference
  response_value text, -- Store all responses as text
  response_number numeric, -- For numeric responses (stars, nps)
  response_boolean boolean, -- For yes/no responses
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_feedback_responses ENABLE ROW LEVEL SECURITY;

-- RLS for feedback_questions
CREATE POLICY "Users can view feedback questions in their account"
ON public.feedback_questions FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert feedback questions in their account"
ON public.feedback_questions FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update feedback questions in their account"
ON public.feedback_questions FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete feedback questions in their account"
ON public.feedback_questions FOR DELETE
USING (account_id = get_user_account_id());

-- RLS for event_feedback_questions
CREATE POLICY "Users can view event feedback questions in their account"
ON public.event_feedback_questions FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert event feedback questions in their account"
ON public.event_feedback_questions FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update event feedback questions in their account"
ON public.event_feedback_questions FOR UPDATE
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete event feedback questions in their account"
ON public.event_feedback_questions FOR DELETE
USING (account_id = get_user_account_id());

-- RLS for event_feedback_responses
CREATE POLICY "Users can view feedback responses in their account"
ON public.event_feedback_responses FOR SELECT
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert feedback responses in their account"
ON public.event_feedback_responses FOR INSERT
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can delete feedback responses in their account"
ON public.event_feedback_responses FOR DELETE
USING (account_id = get_user_account_id());

-- Add index for performance
CREATE INDEX idx_feedback_questions_account ON public.feedback_questions(account_id);
CREATE INDEX idx_event_feedback_questions_event ON public.event_feedback_questions(event_id);
CREATE INDEX idx_event_feedback_responses_feedback ON public.event_feedback_responses(feedback_id);