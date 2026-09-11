ALTER TABLE public.threecplus_call_logs
  ADD COLUMN IF NOT EXISTS activity_id uuid,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.threecplus_call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  call_log_id uuid NOT NULL REFERENCES public.threecplus_call_logs(id) ON DELETE CASCADE,
  call_id text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  recording_url text,
  transcript text,
  summary jsonb,
  temperature text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT threecplus_call_transcripts_call_log_unique UNIQUE (call_log_id)
);

CREATE INDEX IF NOT EXISTS idx_3c_transcripts_status ON public.threecplus_call_transcripts (account_id, status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threecplus_call_transcripts TO authenticated;
GRANT ALL ON public.threecplus_call_transcripts TO service_role;

ALTER TABLE public.threecplus_call_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account 3c transcripts"
  ON public.threecplus_call_transcripts FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can insert account 3c transcripts"
  ON public.threecplus_call_transcripts FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can update account 3c transcripts"
  ON public.threecplus_call_transcripts FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_threecplus_call_transcripts_updated_at
  BEFORE UPDATE ON public.threecplus_call_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();