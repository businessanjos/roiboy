CREATE TABLE public.event_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  day_number INT NOT NULL DEFAULT 1,
  event_date DATE,
  title TEXT,
  transcript_text TEXT,
  transcript_file_url TEXT,
  cover_image_url TEXT,
  generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  pdf_url TEXT,
  ai_model TEXT,
  ai_tokens_input INT,
  ai_tokens_output INT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_summaries_event ON public.event_summaries(event_id, day_number);
CREATE INDEX idx_event_summaries_account ON public.event_summaries(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_summaries TO authenticated;
GRANT ALL ON public.event_summaries TO service_role;

ALTER TABLE public.event_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members read event summaries"
  ON public.event_summaries FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members insert event summaries"
  ON public.event_summaries FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members update event summaries"
  ON public.event_summaries FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members delete event summaries"
  ON public.event_summaries FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER event_summaries_updated_at
  BEFORE UPDATE ON public.event_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();