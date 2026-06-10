
-- 1. Coluna de vínculo
ALTER TABLE public.hr_job_offers
  ADD COLUMN IF NOT EXISTS application_id uuid
  REFERENCES public.hr_job_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS hr_job_offers_application_id_idx
  ON public.hr_job_offers(application_id);

-- 2. Função para criar candidatura a partir de uma oferta sem vínculo
CREATE OR REPLACE FUNCTION public.ensure_application_for_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_app_id uuid;
BEGIN
  IF NEW.application_id IS NOT NULL OR NEW.job_id IS NULL OR NEW.is_template THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.hr_job_applications (
    job_id, account_id, candidate_name, candidate_email,
    candidate_phone, stage, status
  ) VALUES (
    NEW.job_id,
    NEW.account_id,
    NEW.candidate_name,
    COALESCE(NULLIF(NEW.candidate_email, ''), 'sem-email+' || NEW.id || '@placeholder.local'),
    NEW.candidate_phone,
    'offer',
    'active'
  )
  RETURNING id INTO new_app_id;

  NEW.application_id := new_app_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_application_for_offer ON public.hr_job_offers;
CREATE TRIGGER trg_ensure_application_for_offer
  BEFORE INSERT ON public.hr_job_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_application_for_offer();

-- 3. Backfill: para cada oferta existente (não-template) sem application_id,
--    cria UMA candidatura por candidato distinto da mesma vaga e vincula todas as ofertas dele.
DO $$
DECLARE
  r record;
  new_app_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (job_id, candidate_name)
      id, job_id, account_id, candidate_name, candidate_email, candidate_phone
    FROM public.hr_job_offers
    WHERE application_id IS NULL
      AND is_template = false
      AND job_id IS NOT NULL
    ORDER BY job_id, candidate_name, created_at ASC
  LOOP
    INSERT INTO public.hr_job_applications (
      job_id, account_id, candidate_name, candidate_email,
      candidate_phone, stage, status
    ) VALUES (
      r.job_id,
      r.account_id,
      r.candidate_name,
      COALESCE(NULLIF(r.candidate_email, ''), 'sem-email+' || r.id || '@placeholder.local'),
      r.candidate_phone,
      'offer',
      'active'
    )
    RETURNING id INTO new_app_id;

    UPDATE public.hr_job_offers
      SET application_id = new_app_id
      WHERE job_id = r.job_id
        AND candidate_name = r.candidate_name
        AND application_id IS NULL
        AND is_template = false;
  END LOOP;
END $$;
