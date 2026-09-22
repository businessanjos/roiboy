ALTER TABLE public.hr_collaborators
  ADD COLUMN IF NOT EXISTS pda_hierarchy text,
  ADD COLUMN IF NOT EXISTS pda_sectors text[],
  ADD COLUMN IF NOT EXISTS pda_level text,
  ADD COLUMN IF NOT EXISTS pda_role_profile text,
  ADD COLUMN IF NOT EXISTS pda_dominant_profile text,
  ADD COLUMN IF NOT EXISTS pda_secondary_profile text,
  ADD COLUMN IF NOT EXISTS pda_synergy boolean,
  ADD COLUMN IF NOT EXISTS pda_synergy_pct integer,
  ADD COLUMN IF NOT EXISTS pda_pdi_done boolean,
  ADD COLUMN IF NOT EXISTS pda_pdi_delivered boolean,
  ADD COLUMN IF NOT EXISTS pda_effort_level text,
  ADD COLUMN IF NOT EXISTS pda_change_quality text,
  ADD COLUMN IF NOT EXISTS pda_phase text,
  ADD COLUMN IF NOT EXISTS pda_temperament text,
  ADD COLUMN IF NOT EXISTS pda_mental_model text,
  ADD COLUMN IF NOT EXISTS pda_thermometer text,
  ADD COLUMN IF NOT EXISTS pda_education text,
  ADD COLUMN IF NOT EXISTS salary_without_charges numeric(12,2),
  ADD COLUMN IF NOT EXISTS salary_with_charges numeric(12,2),
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.hr_collaborators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_collaborators_manager_id ON public.hr_collaborators(manager_id);

CREATE OR REPLACE FUNCTION public.pda_synergy_pct(_role_profile text, _dominant text, _secondary text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_exp_dom text;
  v_exp_sec text;
BEGIN
  IF _role_profile IS NULL OR btrim(_role_profile) = '' THEN
    RETURN NULL;
  END IF;
  v_exp_dom := btrim(split_part(_role_profile, '/', 1));
  v_exp_sec := btrim(split_part(_role_profile, '/', 2));

  IF _dominant IS NOT NULL AND _dominant = v_exp_dom AND _secondary IS NOT NULL AND _secondary = v_exp_sec THEN
    RETURN 100;
  END IF;
  IF _dominant IS NOT NULL AND _secondary IS NOT NULL AND _dominant = v_exp_sec AND _secondary = v_exp_dom THEN
    RETURN 75;
  END IF;
  IF _dominant IS NOT NULL AND _dominant = v_exp_dom THEN
    RETURN 50;
  END IF;
  IF (_secondary IS NOT NULL AND _secondary = v_exp_sec) THEN
    RETURN 50;
  END IF;
  IF (_dominant IS NOT NULL AND _dominant = v_exp_sec) OR (_secondary IS NOT NULL AND _secondary = v_exp_dom) THEN
    RETURN 25;
  END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.hr_collaborators_set_synergy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.pda_synergy_pct := public.pda_synergy_pct(NEW.pda_role_profile, NEW.pda_dominant_profile, NEW.pda_secondary_profile);
  NEW.pda_synergy := CASE WHEN NEW.pda_synergy_pct IS NULL THEN NULL ELSE NEW.pda_synergy_pct >= 75 END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_collaborators_set_synergy ON public.hr_collaborators;
CREATE TRIGGER trg_hr_collaborators_set_synergy
BEFORE INSERT OR UPDATE OF pda_role_profile, pda_dominant_profile, pda_secondary_profile
ON public.hr_collaborators
FOR EACH ROW EXECUTE FUNCTION public.hr_collaborators_set_synergy();