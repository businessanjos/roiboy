
-- ─── Admissions ──────────────────────────────────────────
CREATE TABLE public.hr_admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  offer_id uuid REFERENCES public.hr_job_offers(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.hr_jobs(id) ON DELETE SET NULL,
  candidate_name text NOT NULL,
  candidate_email text,
  candidate_phone text,
  candidate_photo_url text,
  position_title text,
  department text,
  contract_type text NOT NULL DEFAULT 'clt',
  start_date date,
  stage text NOT NULL DEFAULT 'accepted',
  -- Exame
  exam_clinic text,
  exam_scheduled_at timestamptz,
  exam_result text,
  exam_done_at timestamptz,
  -- Contrato / integração
  contract_signed_at timestamptz,
  onboarding_scheduled_at timestamptz,
  admitted_at timestamptz,
  notes text,
  responsible_user_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_admissions_account ON public.hr_admissions(account_id);
CREATE INDEX idx_hr_admissions_stage ON public.hr_admissions(account_id, stage);
CREATE UNIQUE INDEX uniq_hr_admissions_offer ON public.hr_admissions(offer_id) WHERE offer_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_admissions TO authenticated;
GRANT ALL ON public.hr_admissions TO service_role;

ALTER TABLE public.hr_admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage admissions"
  ON public.hr_admissions
  FOR ALL
  TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE TRIGGER trg_hr_admissions_updated_at
  BEFORE UPDATE ON public.hr_admissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Documents checklist ──────────────────────────────────
CREATE TABLE public.hr_admission_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.hr_admissions(id) ON DELETE CASCADE,
  doc_key text NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending', -- pending | received | approved | rejected
  file_url text,
  file_name text,
  uploaded_at timestamptz,
  uploaded_by uuid,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_admission_docs_admission ON public.hr_admission_documents(admission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_admission_documents TO authenticated;
GRANT ALL ON public.hr_admission_documents TO service_role;

ALTER TABLE public.hr_admission_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage admission docs"
  ON public.hr_admission_documents
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hr_admissions a WHERE a.id = admission_id AND a.account_id = public.get_user_account_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hr_admissions a WHERE a.id = admission_id AND a.account_id = public.get_user_account_id()));

CREATE TRIGGER trg_hr_admission_docs_updated_at
  BEFORE UPDATE ON public.hr_admission_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Default CLT checklist seeder ─────────────────────────
CREATE OR REPLACE FUNCTION public.seed_clt_admission_docs(_admission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  docs text[][] := ARRAY[
    ARRAY['rg', 'RG (frente e verso)'],
    ARRAY['cpf', 'CPF'],
    ARRAY['ctps', 'CTPS Digital (PDF)'],
    ARRAY['titulo_eleitor', 'Título de Eleitor'],
    ARRAY['reservista', 'Certificado de Reservista (homens)'],
    ARRAY['comprovante_residencia', 'Comprovante de Residência (até 90 dias)'],
    ARRAY['pis_pasep', 'PIS / PASEP / NIT'],
    ARRAY['certidao_civil', 'Certidão de Nascimento ou Casamento'],
    ARRAY['certidao_filhos', 'Certidão de Nascimento dos Filhos (até 14 anos)'],
    ARRAY['foto_3x4', 'Foto 3x4 recente'],
    ARRAY['comprovante_escolaridade', 'Comprovante de Escolaridade'],
    ARRAY['conta_bancaria', 'Dados Bancários (conta salário)'],
    ARRAY['exame_admissional', 'ASO – Exame Admissional'],
    ARRAY['contrato_assinado', 'Contrato de Trabalho Assinado']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(docs, 1) LOOP
    INSERT INTO public.hr_admission_documents (admission_id, doc_key, label, sort_order)
    VALUES (_admission_id, docs[i][1], docs[i][2], i);
  END LOOP;
END;
$$;

-- ─── Auto-create admission when offer is accepted ─────────
CREATE OR REPLACE FUNCTION public.create_admission_on_offer_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') AND COALESCE(NEW.is_template, false) = false THEN
    -- Skip if already exists
    IF EXISTS (SELECT 1 FROM public.hr_admissions WHERE offer_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.hr_admissions (
      account_id, offer_id, job_id,
      candidate_name, candidate_email, candidate_phone, candidate_photo_url,
      position_title, department, contract_type, start_date, stage
    ) VALUES (
      NEW.account_id, NEW.id, NEW.job_id,
      NEW.candidate_name, NEW.candidate_email, NEW.candidate_phone, NEW.candidate_photo_url,
      NEW.position_title, NEW.department, COALESCE(NEW.contract_type, 'clt'), NEW.start_date, 'accepted'
    ) RETURNING id INTO new_id;

    IF COALESCE(NEW.contract_type, 'clt') = 'clt' THEN
      PERFORM public.seed_clt_admission_docs(new_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_offer_accepted_create_admission
  AFTER UPDATE OF status ON public.hr_job_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.create_admission_on_offer_accept();

-- ─── Backfill: existing accepted offers ───────────────────
DO $$
DECLARE r record; new_id uuid;
BEGIN
  FOR r IN SELECT * FROM public.hr_job_offers WHERE status = 'accepted' AND COALESCE(is_template, false) = false LOOP
    IF NOT EXISTS (SELECT 1 FROM public.hr_admissions WHERE offer_id = r.id) THEN
      INSERT INTO public.hr_admissions (
        account_id, offer_id, job_id,
        candidate_name, candidate_email, candidate_phone, candidate_photo_url,
        position_title, department, contract_type, start_date, stage
      ) VALUES (
        r.account_id, r.id, r.job_id,
        r.candidate_name, r.candidate_email, r.candidate_phone, r.candidate_photo_url,
        r.position_title, r.department, COALESCE(r.contract_type, 'clt'), r.start_date, 'accepted'
      ) RETURNING id INTO new_id;
      IF COALESCE(r.contract_type, 'clt') = 'clt' THEN
        PERFORM public.seed_clt_admission_docs(new_id);
      END IF;
    END IF;
  END LOOP;
END $$;
