
CREATE TABLE public.hr_job_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  created_by UUID,
  job_id UUID REFERENCES public.hr_jobs(id) ON DELETE SET NULL,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_phone TEXT,
  position_title TEXT NOT NULL,
  department TEXT,
  seniority TEXT,
  work_model TEXT,
  contract_type TEXT,
  unit TEXT,
  reports_to TEXT,
  salary_amount NUMERIC,
  salary_currency TEXT NOT NULL DEFAULT 'BRL',
  salary_note TEXT,
  variable_compensation TEXT,
  benefits TEXT[] NOT NULL DEFAULT '{}',
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE,
  offer_expires_at DATE,
  hero_headline TEXT,
  company_intro TEXT,
  role_pitch TEXT,
  next_steps TEXT,
  signer_name TEXT,
  signer_role TEXT,
  cover_image_url TEXT,
  accent_color TEXT NOT NULL DEFAULT '#6366F1',
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,
  responded_at TIMESTAMPTZ,
  response_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_job_offers_account ON public.hr_job_offers(account_id);
CREATE INDEX idx_hr_job_offers_token ON public.hr_job_offers(public_token);

GRANT SELECT ON public.hr_job_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_job_offers TO authenticated;
GRANT ALL ON public.hr_job_offers TO service_role;

ALTER TABLE public.hr_job_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage own offers"
ON public.hr_job_offers FOR ALL
TO authenticated
USING (account_id = public.get_user_account_id())
WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Public can read offers by token"
ON public.hr_job_offers FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Public can respond to offer"
ON public.hr_job_offers FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_hr_job_offers_updated_at
BEFORE UPDATE ON public.hr_job_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
