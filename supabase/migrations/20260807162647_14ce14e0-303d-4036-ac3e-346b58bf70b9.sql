-- 1. Templates library
CREATE TABLE public.hr_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  doc_key text NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'admissao',
  body_html text NOT NULL DEFAULT '',
  default_selected boolean NOT NULL DEFAULT true,
  required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, doc_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_document_templates TO authenticated;
GRANT ALL ON public.hr_document_templates TO service_role;

ALTER TABLE public.hr_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members manage document templates"
ON public.hr_document_templates FOR ALL TO authenticated
USING (account_id = public.get_current_user_account_id())
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_hr_document_templates_updated_at
BEFORE UPDATE ON public.hr_document_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Admission signer data
ALTER TABLE public.hr_admissions
  ADD COLUMN IF NOT EXISTS signer_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Signature fields on admission documents
ALTER TABLE public.hr_admission_documents
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.hr_document_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS signature_image_url text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_cpf text,
  ADD COLUMN IF NOT EXISTS signer_ip text,
  ADD COLUMN IF NOT EXISTS signer_user_agent text,
  ADD COLUMN IF NOT EXISTS signed_html text,
  ADD COLUMN IF NOT EXISTS signature_hash text;

-- 4. Portal RPC: save signer data
CREATE OR REPLACE FUNCTION public.save_admission_signer_data(_token text, _data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.hr_admissions
   WHERE public_token = _token
     AND (token_expires_at IS NULL OR token_expires_at > now());
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  UPDATE public.hr_admissions
     SET signer_data = COALESCE(signer_data, '{}'::jsonb) || COALESCE(_data, '{}'::jsonb),
         updated_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Portal RPC: sign a document
CREATE OR REPLACE FUNCTION public.sign_admission_document(
  _token text,
  _doc_id uuid,
  _signature_url text,
  _signed_html text,
  _signer_name text,
  _signer_cpf text,
  _ip text,
  _user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.hr_admissions
   WHERE public_token = _token
     AND (token_expires_at IS NULL OR token_expires_at > now());
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hr_admission_documents
     WHERE id = _doc_id AND admission_id = v_id AND doc_type = 'signature'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_document');
  END IF;

  UPDATE public.hr_admission_documents
     SET status = 'received',
         signature_image_url = _signature_url,
         signed_html = _signed_html,
         signer_name = _signer_name,
         signer_cpf = _signer_cpf,
         signer_ip = _ip,
         signer_user_agent = _user_agent,
         signed_at = now(),
         signature_hash = encode(digest(COALESCE(_signed_html, '') || COALESCE(_signer_cpf, '') || now()::text, 'sha256'), 'hex'),
         uploaded_via = 'candidate',
         uploaded_at = now(),
         notes = NULL,
         updated_at = now()
   WHERE id = _doc_id;

  UPDATE public.hr_admissions SET updated_at = now() WHERE id = v_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 6. Portal read RPC now exposes signature fields + signer data
CREATE OR REPLACE FUNCTION public.get_admission_portal(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission public.hr_admissions%ROWTYPE;
  v_docs JSONB;
BEGIN
  SELECT * INTO v_admission FROM public.hr_admissions WHERE public_token = _token;
  IF v_admission.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_admission.token_expires_at IS NOT NULL AND v_admission.token_expires_at < now() THEN
    RETURN jsonb_build_object('expired', true);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'doc_key', d.doc_key,
    'label', d.label,
    'required', d.required,
    'status', d.status,
    'file_name', d.file_name,
    'file_url', d.file_url,
    'uploaded_at', d.uploaded_at,
    'uploaded_via', d.uploaded_via,
    'attachments', COALESCE(d.attachments, '[]'::jsonb),
    'notes', d.notes,
    'sort_order', d.sort_order,
    'doc_type', COALESCE(d.doc_type, 'file'),
    'form_schema', d.form_schema,
    'form_data', d.form_data,
    'ocr_kind', d.ocr_kind,
    'ocr_status', d.ocr_status,
    'ocr_data', d.ocr_data,
    'ocr_error', d.ocr_error,
    'body_html', d.body_html,
    'signature_image_url', d.signature_image_url,
    'signed_at', d.signed_at,
    'signer_name', d.signer_name
  ) ORDER BY d.sort_order), '[]'::jsonb)
  INTO v_docs
  FROM public.hr_admission_documents d
  WHERE d.admission_id = v_admission.id
    AND COALESCE(d.visible_to_candidate, true) = true;

  RETURN jsonb_build_object(
    'id', v_admission.id,
    'candidate_name', v_admission.candidate_name,
    'position_title', v_admission.position_title,
    'department', v_admission.department,
    'start_date', v_admission.start_date,
    'stage', v_admission.stage,
    'signer_data', COALESCE(v_admission.signer_data, '{}'::jsonb),
    'documents', v_docs
  );
END;
$$;

-- 7. Seed signature docs from templates on a given admission
CREATE OR REPLACE FUNCTION public.seed_admission_signature_docs(_admission_id uuid, _template_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account uuid;
  v_count integer := 0;
  v_base integer;
  t RECORD;
BEGIN
  SELECT account_id INTO v_account FROM public.hr_admissions WHERE id = _admission_id;
  IF v_account IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(MAX(sort_order), 0) INTO v_base
    FROM public.hr_admission_documents WHERE admission_id = _admission_id;

  FOR t IN
    SELECT * FROM public.hr_document_templates
     WHERE account_id = v_account
       AND active = true
       AND category = 'admissao'
       AND (
         (_template_ids IS NULL AND default_selected = true)
         OR (_template_ids IS NOT NULL AND id = ANY(_template_ids))
       )
     ORDER BY sort_order, title
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.hr_admission_documents
       WHERE admission_id = _admission_id AND doc_key = t.doc_key
    ) THEN
      v_count := v_count + 1;
      INSERT INTO public.hr_admission_documents
        (admission_id, doc_key, label, required, sort_order, doc_type, visible_to_candidate, template_id, body_html, status)
      VALUES
        (_admission_id, t.doc_key, t.title, t.required, v_base + v_count, 'signature', true, t.id, t.body_html, 'pending');
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 8. Hook into offer acceptance
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
      PERFORM public.seed_admission_signature_docs(new_id, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;