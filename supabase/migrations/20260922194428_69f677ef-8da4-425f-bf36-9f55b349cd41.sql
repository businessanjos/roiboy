
-- Helpers de acesso ao PDA
CREATE OR REPLACE FUNCTION public.pda_is_hr_or_director()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        u.role IN ('admin','super_admin','head')
        OR lower(u.email) IN (
          'm.quintana@me.com','coachevertonsantos@gmail.com','rh@anjosbusiness.com.br',
          'diessica@consultoria-luma.com','jaqueline@consultoria-luma.com','brualmeida.est@hotmail.com',
          'arthur.mudri@hotmail.com','jessicamarcato@anjosbusiness.com','anjosgroup.dados@anjosbusiness.com',
          'rh2@eternumoficial.com'
        )
        OR EXISTS (
          SELECT 1 FROM public.user_sector_access s
          WHERE s.user_id = u.id AND s.sector_id = 'rh' AND s.is_active
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_pda(_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pda_is_hr_or_director()
    OR EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.hr_collaborators me
        ON (me.user_id = u.id OR lower(me.email) = lower(u.email))
      WHERE u.auth_user_id = auth.uid()
        AND (
          EXISTS (SELECT 1 FROM public.hr_collaborators c WHERE c.id = _person_id AND c.manager_id = me.id)
          OR EXISTS (SELECT 1 FROM public.hr_service_providers p WHERE p.id = _person_id AND p.manager_id = me.id)
        )
    )
$$;

-- Campos extras na ficha
ALTER TABLE public.hr_collaborators
  ADD COLUMN IF NOT EXISTS pda_instagram text,
  ADD COLUMN IF NOT EXISTS pda_notes text;
ALTER TABLE public.hr_service_providers
  ADD COLUMN IF NOT EXISTS pda_instagram text,
  ADD COLUMN IF NOT EXISTS pda_notes text;

-- Cargos: conteúdo de perfil
ALTER TABLE public.hr_positions
  ADD COLUMN IF NOT EXISTS pda_hierarchy text,
  ADD COLUMN IF NOT EXISTS ideal_primary_profile text,
  ADD COLUMN IF NOT EXISTS ideal_secondary_profile text,
  ADD COLUMN IF NOT EXISTS specific_knowledge text,
  ADD COLUMN IF NOT EXISTS profile_notes text;

-- Reuniões RH-Diretoria: decisões
ALTER TABLE public.hr_rh_meetings
  ADD COLUMN IF NOT EXISTS decisions text;

-- Ciclos de PDI
CREATE TABLE IF NOT EXISTS public.hr_pda_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  person_id uuid NOT NULL,
  source_table text NOT NULL DEFAULT 'hr_collaborators',
  label text NOT NULL,
  pdi_done boolean,
  pdi_delivered boolean,
  effort_level text,
  change_quality text,
  plan text,
  starts_on date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_pda_cycles TO authenticated;
GRANT ALL ON public.hr_pda_cycles TO service_role;
ALTER TABLE public.hr_pda_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pda_cycles_access" ON public.hr_pda_cycles FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND public.can_access_pda(person_id))
  WITH CHECK (account_id = get_current_user_account_id() AND public.can_access_pda(person_id));
CREATE INDEX IF NOT EXISTS hr_pda_cycles_person_idx ON public.hr_pda_cycles(person_id, created_at DESC);
CREATE TRIGGER update_hr_pda_cycles_updated_at BEFORE UPDATE ON public.hr_pda_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Acompanhamentos
CREATE TABLE IF NOT EXISTS public.hr_pda_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  person_id uuid NOT NULL,
  source_table text NOT NULL DEFAULT 'hr_collaborators',
  followup_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL DEFAULT 'Pontual',
  angel_feedback text,
  management_feedback text,
  attention_points text,
  author_id uuid,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_pda_followups TO authenticated;
GRANT ALL ON public.hr_pda_followups TO service_role;
ALTER TABLE public.hr_pda_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pda_followups_access" ON public.hr_pda_followups FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND public.can_access_pda(person_id))
  WITH CHECK (account_id = get_current_user_account_id() AND public.can_access_pda(person_id));
CREATE INDEX IF NOT EXISTS hr_pda_followups_person_idx ON public.hr_pda_followups(person_id, followup_date DESC);
CREATE TRIGGER update_hr_pda_followups_updated_at BEFORE UPDATE ON public.hr_pda_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mapa de empatia
CREATE TABLE IF NOT EXISTS public.hr_pda_empathy_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  person_id uuid NOT NULL UNIQUE,
  source_table text NOT NULL DEFAULT 'hr_collaborators',
  angel_thinks text, angel_hears text, angel_says text, angel_sees text, angel_pains text, angel_gains text,
  mgmt_thinks text, mgmt_hears text, mgmt_says text, mgmt_sees text, mgmt_pains text, mgmt_gains text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_pda_empathy_maps TO authenticated;
GRANT ALL ON public.hr_pda_empathy_maps TO service_role;
ALTER TABLE public.hr_pda_empathy_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pda_empathy_maps_access" ON public.hr_pda_empathy_maps FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND public.can_access_pda(person_id))
  WITH CHECK (account_id = get_current_user_account_id() AND public.can_access_pda(person_id));
CREATE TRIGGER update_hr_pda_empathy_maps_updated_at BEFORE UPDATE ON public.hr_pda_empathy_maps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documentos do PDA
CREATE TABLE IF NOT EXISTS public.hr_pda_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  person_id uuid NOT NULL,
  source_table text NOT NULL DEFAULT 'hr_collaborators',
  doc_type text NOT NULL DEFAULT 'Outro',
  doc_date date,
  description text,
  file_path text,
  file_name text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_pda_documents TO authenticated;
GRANT ALL ON public.hr_pda_documents TO service_role;
ALTER TABLE public.hr_pda_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pda_documents_access" ON public.hr_pda_documents FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND public.can_access_pda(person_id))
  WITH CHECK (account_id = get_current_user_account_id() AND public.can_access_pda(person_id));
CREATE INDEX IF NOT EXISTS hr_pda_documents_person_idx ON public.hr_pda_documents(person_id, created_at DESC);
CREATE TRIGGER update_hr_pda_documents_updated_at BEFORE UPDATE ON public.hr_pda_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Perfis comportamentais
CREATE TABLE IF NOT EXISTS public.hr_behavior_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  profile_key text NOT NULL,
  leadership_style text,
  motivation text,
  communication text[] NOT NULL DEFAULT '{}',
  strengths text,
  improvements text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, profile_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_behavior_profiles TO authenticated;
GRANT ALL ON public.hr_behavior_profiles TO service_role;
ALTER TABLE public.hr_behavior_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_behavior_profiles_access" ON public.hr_behavior_profiles FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND public.pda_is_hr_or_director())
  WITH CHECK (account_id = get_current_user_account_id() AND public.pda_is_hr_or_director());
CREATE TRIGGER update_hr_behavior_profiles_updated_at BEFORE UPDATE ON public.hr_behavior_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alinhamentos de equipe
CREATE TABLE IF NOT EXISTS public.hr_team_alignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  sector text,
  title text NOT NULL,
  alignment_date date,
  content text,
  file_path text,
  file_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_team_alignments TO authenticated;
GRANT ALL ON public.hr_team_alignments TO service_role;
ALTER TABLE public.hr_team_alignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_team_alignments_access" ON public.hr_team_alignments FOR ALL TO authenticated
  USING (account_id = get_current_user_account_id() AND public.pda_is_hr_or_director())
  WITH CHECK (account_id = get_current_user_account_id() AND public.pda_is_hr_or_director());
CREATE TRIGGER update_hr_team_alignments_updated_at BEFORE UPDATE ON public.hr_team_alignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
