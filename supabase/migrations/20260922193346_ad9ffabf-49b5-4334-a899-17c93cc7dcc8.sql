-- Histórico de alterações dos campos do PDA
CREATE TABLE public.hr_pda_field_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  person_id uuid NOT NULL,
  source_table text NOT NULL,
  field_key text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.hr_pda_field_history TO authenticated;
GRANT ALL ON public.hr_pda_field_history TO service_role;
ALTER TABLE public.hr_pda_field_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pda_field_history_select" ON public.hr_pda_field_history
  FOR SELECT TO authenticated USING (account_id = public.get_current_user_account_id());
CREATE POLICY "hr_pda_field_history_insert" ON public.hr_pda_field_history
  FOR INSERT TO authenticated WITH CHECK (account_id = public.get_current_user_account_id());
CREATE INDEX idx_hr_pda_field_history_person ON public.hr_pda_field_history (person_id, created_at DESC);

-- Check-ins do PDA
CREATE TABLE public.hr_pda_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  person_id uuid NOT NULL,
  source_table text NOT NULL DEFAULT 'hr_collaborators',
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  title text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_pda_checkins TO authenticated;
GRANT ALL ON public.hr_pda_checkins TO service_role;
ALTER TABLE public.hr_pda_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_pda_checkins_all" ON public.hr_pda_checkins
  FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE INDEX idx_hr_pda_checkins_sched ON public.hr_pda_checkins (account_id, scheduled_at);

-- Reuniões RH-Diretoria
CREATE TABLE public.hr_rh_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  title text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  notes text,
  participants text[],
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_rh_meetings TO authenticated;
GRANT ALL ON public.hr_rh_meetings TO service_role;
ALTER TABLE public.hr_rh_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hr_rh_meetings_all" ON public.hr_rh_meetings
  FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());
CREATE INDEX idx_hr_rh_meetings_sched ON public.hr_rh_meetings (account_id, scheduled_at);

CREATE TRIGGER trg_hr_pda_checkins_updated_at BEFORE UPDATE ON public.hr_pda_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_hr_rh_meetings_updated_at BEFORE UPDATE ON public.hr_rh_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registro automático das mudanças dos campos do PDA
CREATE OR REPLACE FUNCTION public.log_pda_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f text;
  fields text[] := ARRAY[
    'pda_hierarchy','pda_level','pda_role_profile','pda_dominant_profile','pda_secondary_profile',
    'pda_pdi_done','pda_pdi_delivered','pda_effort_level','pda_change_quality','pda_phase',
    'pda_temperament','pda_mental_model','pda_thermometer','pda_education','position',
    'registration_company','manager_id','status','termination_date'
  ];
  oldj jsonb := to_jsonb(OLD);
  newj jsonb := to_jsonb(NEW);
  ov text;
  nv text;
  actor uuid;
  actor_name text;
BEGIN
  SELECT u.id, u.name INTO actor, actor_name FROM public.users u WHERE u.auth_user_id = auth.uid() LIMIT 1;
  FOREACH f IN ARRAY fields LOOP
    IF (oldj ? f) AND (newj ? f) THEN
      ov := oldj ->> f;
      nv := newj ->> f;
      IF ov IS DISTINCT FROM nv THEN
        INSERT INTO public.hr_pda_field_history (account_id, person_id, source_table, field_key, old_value, new_value, changed_by, changed_by_name)
        VALUES (NEW.account_id, NEW.id, TG_TABLE_NAME, f, ov, nv, actor, actor_name);
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_pda_changes_collaborators
  AFTER UPDATE ON public.hr_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.log_pda_field_changes();
CREATE TRIGGER trg_log_pda_changes_providers
  AFTER UPDATE ON public.hr_service_providers
  FOR EACH ROW EXECUTE FUNCTION public.log_pda_field_changes();