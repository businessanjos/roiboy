CREATE TABLE public.ai_knowledge_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  business_summary text,
  target_audience text,
  offer_type text,
  selling_to text,
  average_ticket text,
  tone_of_voice text,
  competitors text[] NOT NULL DEFAULT '{}',
  discovery_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualification_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  opening_scripts jsonb NOT NULL DEFAULT '{}'::jsonb,
  web_sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_settings TO authenticated;
GRANT ALL ON public.ai_knowledge_settings TO service_role;
ALTER TABLE public.ai_knowledge_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_knowledge_settings_select" ON public.ai_knowledge_settings
  FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_settings_insert" ON public.ai_knowledge_settings
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_settings_update" ON public.ai_knowledge_settings
  FOR UPDATE TO authenticated USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_settings_delete" ON public.ai_knowledge_settings
  FOR DELETE TO authenticated USING (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_ai_knowledge_settings_updated_at
  BEFORE UPDATE ON public.ai_knowledge_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_name text,
  file_path text,
  file_type text,
  file_size bigint,
  source_type text NOT NULL DEFAULT 'upload',
  source_url text,
  extracted_text text,
  chunks_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_documents TO authenticated;
GRANT ALL ON public.ai_knowledge_documents TO service_role;
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_knowledge_documents_select" ON public.ai_knowledge_documents
  FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_documents_insert" ON public.ai_knowledge_documents
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_documents_update" ON public.ai_knowledge_documents
  FOR UPDATE TO authenticated USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_documents_delete" ON public.ai_knowledge_documents
  FOR DELETE TO authenticated USING (account_id = public.get_current_user_account_id());

CREATE INDEX idx_ai_knowledge_documents_account ON public.ai_knowledge_documents(account_id, created_at DESC);

CREATE TRIGGER update_ai_knowledge_documents_updated_at
  BEFORE UPDATE ON public.ai_knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_knowledge_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_message text,
  incorrect_response text,
  problem_identified text,
  expected_response text NOT NULL,
  action_type text NOT NULL DEFAULT 'guideline',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_corrections TO authenticated;
GRANT ALL ON public.ai_knowledge_corrections TO service_role;
ALTER TABLE public.ai_knowledge_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_knowledge_corrections_select" ON public.ai_knowledge_corrections
  FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_corrections_insert" ON public.ai_knowledge_corrections
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_corrections_update" ON public.ai_knowledge_corrections
  FOR UPDATE TO authenticated USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE POLICY "ai_knowledge_corrections_delete" ON public.ai_knowledge_corrections
  FOR DELETE TO authenticated USING (account_id = public.get_current_user_account_id());

CREATE INDEX idx_ai_knowledge_corrections_account ON public.ai_knowledge_corrections(account_id, is_active);

CREATE TRIGGER update_ai_knowledge_corrections_updated_at
  BEFORE UPDATE ON public.ai_knowledge_corrections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();