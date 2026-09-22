-- 1) Campos PDA para prestadores (PJ)
ALTER TABLE public.hr_service_providers
  ADD COLUMN IF NOT EXISTS registration_company text,
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
  ADD COLUMN IF NOT EXISTS net_salary numeric(12,2),
  ADD COLUMN IF NOT EXISTS salary_without_charges numeric(12,2),
  ADD COLUMN IF NOT EXISTS salary_with_charges numeric(12,2),
  ADD COLUMN IF NOT EXISTS manager_id uuid;

CREATE OR REPLACE FUNCTION public.hr_service_providers_set_synergy()
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

DROP TRIGGER IF EXISTS trg_hr_service_providers_set_synergy ON public.hr_service_providers;
CREATE TRIGGER trg_hr_service_providers_set_synergy
BEFORE INSERT OR UPDATE OF pda_role_profile, pda_dominant_profile, pda_secondary_profile
ON public.hr_service_providers
FOR EACH ROW EXECUTE FUNCTION public.hr_service_providers_set_synergy();

-- 2) Opções configuráveis do PDA
CREATE TABLE IF NOT EXISTS public.hr_pda_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  field_key text NOT NULL,
  value text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, field_key, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_pda_options TO authenticated;
GRANT ALL ON public.hr_pda_options TO service_role;

ALTER TABLE public.hr_pda_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view hr_pda_options of their account"
ON public.hr_pda_options FOR SELECT TO authenticated
USING (account_id = get_my_account_id());

CREATE POLICY "Users can insert hr_pda_options in their account"
ON public.hr_pda_options FOR INSERT TO authenticated
WITH CHECK (account_id = get_my_account_id());

CREATE POLICY "Users can update hr_pda_options in their account"
ON public.hr_pda_options FOR UPDATE TO authenticated
USING (account_id = get_my_account_id());

CREATE POLICY "Users can delete hr_pda_options in their account"
ON public.hr_pda_options FOR DELETE TO authenticated
USING (account_id = get_my_account_id());

CREATE INDEX IF NOT EXISTS idx_hr_pda_options_account_field
  ON public.hr_pda_options(account_id, field_key, sort_order);

CREATE TRIGGER update_hr_pda_options_updated_at
BEFORE UPDATE ON public.hr_pda_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();