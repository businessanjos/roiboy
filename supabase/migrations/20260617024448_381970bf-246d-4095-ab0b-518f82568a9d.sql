
-- ============ Extend hr_offboardings ============
ALTER TABLE public.hr_offboardings
  ADD COLUMN IF NOT EXISTS subject_type text NOT NULL DEFAULT 'collaborator',
  ADD COLUMN IF NOT EXISTS service_provider_id uuid REFERENCES public.hr_service_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exit_interview_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS exit_interview_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reassignments jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS financial_entry_id uuid;

-- Permitir collaborator_id nulo quando for prestador
ALTER TABLE public.hr_offboardings ALTER COLUMN collaborator_id DROP NOT NULL;

-- ============ hr_offboarding_documents ============
CREATE TABLE IF NOT EXISTS public.hr_offboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_id uuid NOT NULL REFERENCES public.hr_offboardings(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general',
  file_url text NOT NULL,
  file_path text,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_offboarding_documents TO authenticated;
GRANT ALL ON public.hr_offboarding_documents TO service_role;

ALTER TABLE public.hr_offboarding_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view offboarding documents"
ON public.hr_offboarding_documents FOR SELECT
TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert offboarding documents"
ON public.hr_offboarding_documents FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can update offboarding documents"
ON public.hr_offboarding_documents FOR UPDATE
TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can delete offboarding documents"
ON public.hr_offboarding_documents FOR DELETE
TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_hr_off_docs_offboarding ON public.hr_offboarding_documents(offboarding_id);

-- ============ hr_offboarding_timeline ============
CREATE TABLE IF NOT EXISTS public.hr_offboarding_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offboarding_id uuid NOT NULL REFERENCES public.hr_offboardings(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  actor_user_id uuid,
  event_type text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_offboarding_timeline TO authenticated;
GRANT ALL ON public.hr_offboarding_timeline TO service_role;

ALTER TABLE public.hr_offboarding_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view offboarding timeline"
ON public.hr_offboarding_timeline FOR SELECT
TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert offboarding timeline"
ON public.hr_offboarding_timeline FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Service role manages offboarding timeline"
ON public.hr_offboarding_timeline FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_hr_off_timeline_offboarding ON public.hr_offboarding_timeline(offboarding_id, created_at DESC);

-- ============ Trigger: auto-log timeline ============
CREATE OR REPLACE FUNCTION public.log_offboarding_timeline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid;
BEGIN
  SELECT id INTO v_actor FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hr_offboarding_timeline (offboarding_id, account_id, actor_user_id, event_type, description, metadata)
    VALUES (NEW.id, NEW.account_id, v_actor, 'created', 'Desligamento criado',
            jsonb_build_object('stage', NEW.stage, 'termination_type', NEW.termination_type));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      INSERT INTO public.hr_offboarding_timeline (offboarding_id, account_id, actor_user_id, event_type, description, metadata)
      VALUES (NEW.id, NEW.account_id, v_actor, 'stage_changed', 'Etapa alterada',
              jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
    END IF;
    IF NEW.access_cutoff_done IS DISTINCT FROM OLD.access_cutoff_done AND NEW.access_cutoff_done = true THEN
      INSERT INTO public.hr_offboarding_timeline (offboarding_id, account_id, actor_user_id, event_type, description, metadata)
      VALUES (NEW.id, NEW.account_id, v_actor, 'access_cut', 'Acessos cortados', '{}');
    END IF;
    IF NEW.exit_interview_submitted_at IS DISTINCT FROM OLD.exit_interview_submitted_at AND NEW.exit_interview_submitted_at IS NOT NULL THEN
      INSERT INTO public.hr_offboarding_timeline (offboarding_id, account_id, actor_user_id, event_type, description, metadata)
      VALUES (NEW.id, NEW.account_id, NULL, 'exit_interview_submitted', 'Entrevista de saída respondida pelo colaborador', '{}');
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_offboarding_timeline ON public.hr_offboardings;
CREATE TRIGGER trg_log_offboarding_timeline
AFTER INSERT OR UPDATE ON public.hr_offboardings
FOR EACH ROW EXECUTE FUNCTION public.log_offboarding_timeline();

-- ============ Public access to exit interview by token ============
CREATE POLICY "Public can read offboarding by exit interview token"
ON public.hr_offboardings FOR SELECT
TO anon
USING (exit_interview_token IS NOT NULL);

CREATE POLICY "Public can submit exit interview via token"
ON public.hr_offboardings FOR UPDATE
TO anon
USING (exit_interview_token IS NOT NULL AND exit_interview_submitted_at IS NULL)
WITH CHECK (exit_interview_token IS NOT NULL);

GRANT SELECT ON public.hr_offboardings TO anon;
GRANT UPDATE (exit_interview, exit_nps, exit_interview_submitted_at) ON public.hr_offboardings TO anon;
