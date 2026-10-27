ALTER TABLE public.hr_job_offers ADD COLUMN IF NOT EXISTS custom_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.hr_offer_content_settings (
  account_id uuid PRIMARY KEY,
  kpi_packs jsonb,
  company_intro text,
  next_steps text,
  signer_name text,
  signer_role text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_offer_content_settings TO authenticated;
GRANT ALL ON public.hr_offer_content_settings TO service_role;
ALTER TABLE public.hr_offer_content_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account members manage offer content settings" ON public.hr_offer_content_settings
  FOR ALL TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());