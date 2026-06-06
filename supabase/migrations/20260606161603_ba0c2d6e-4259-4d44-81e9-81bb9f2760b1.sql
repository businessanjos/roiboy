
ALTER TABLE public.hr_admissions
  ADD COLUMN IF NOT EXISTS referral_data jsonb;

CREATE TABLE IF NOT EXISTS public.hr_exam_referral_defaults (
  account_id uuid PRIMARY KEY,
  company_name text,
  company_cnpj text,
  doctor_name text,
  doctor_crm_uf text,
  doctor_rqe text,
  default_unit text,
  default_city text,
  default_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_exam_referral_defaults TO authenticated;
GRANT ALL ON public.hr_exam_referral_defaults TO service_role;

ALTER TABLE public.hr_exam_referral_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own account referral defaults"
  ON public.hr_exam_referral_defaults FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "users manage own account referral defaults"
  ON public.hr_exam_referral_defaults FOR ALL
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()))
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_update_updated_at_referral_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_referral_defaults_updated_at ON public.hr_exam_referral_defaults;
CREATE TRIGGER trg_referral_defaults_updated_at
  BEFORE UPDATE ON public.hr_exam_referral_defaults
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_updated_at_referral_defaults();
