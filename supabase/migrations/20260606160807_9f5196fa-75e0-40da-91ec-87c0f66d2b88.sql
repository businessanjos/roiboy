
-- 1) Novas colunas para OCR em hr_admission_documents
ALTER TABLE public.hr_admission_documents
  ADD COLUMN IF NOT EXISTS ocr_kind text,
  ADD COLUMN IF NOT EXISTS ocr_data jsonb,
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS ocr_error text,
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamptz;

-- ocr_status: idle | processing | ready | confirmed | failed
-- ocr_kind:   id (RG/CNH) | cpf | address (comprovante de residência) | null

-- 2) Backfill por doc_key
UPDATE public.hr_admission_documents
SET ocr_kind = CASE
  WHEN doc_key = 'rg' THEN 'id'
  WHEN doc_key = 'cnh' THEN 'id'
  WHEN doc_key = 'cpf' THEN 'cpf'
  WHEN doc_key = 'comprovante_residencia' THEN 'address'
  ELSE ocr_kind
END
WHERE ocr_kind IS NULL
  AND doc_key IN ('rg','cnh','cpf','comprovante_residencia');

-- 3) Trigger para auto-setar ocr_kind no insert
CREATE OR REPLACE FUNCTION public.set_admission_doc_ocr_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ocr_kind IS NULL THEN
    NEW.ocr_kind := CASE
      WHEN NEW.doc_key = 'rg' THEN 'id'
      WHEN NEW.doc_key = 'cnh' THEN 'id'
      WHEN NEW.doc_key = 'cpf' THEN 'cpf'
      WHEN NEW.doc_key = 'comprovante_residencia' THEN 'address'
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_admission_doc_ocr_kind ON public.hr_admission_documents;
CREATE TRIGGER trg_set_admission_doc_ocr_kind
BEFORE INSERT ON public.hr_admission_documents
FOR EACH ROW EXECUTE FUNCTION public.set_admission_doc_ocr_kind();

-- 4) Atualiza get_admission_portal para retornar campos de OCR
CREATE OR REPLACE FUNCTION public.get_admission_portal(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
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
    'ocr_error', d.ocr_error
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
    'documents', v_docs
  );
END;
$$;

-- 5) RPC para a edge function gravar resultado do OCR
CREATE OR REPLACE FUNCTION public.set_admission_ocr_result(
  _token text,
  _doc_id uuid,
  _status text,
  _data jsonb,
  _error text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission_id uuid;
BEGIN
  SELECT id INTO v_admission_id FROM public.hr_admissions WHERE public_token = _token;
  IF v_admission_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.hr_admission_documents
  SET ocr_status = _status,
      ocr_data   = COALESCE(_data, ocr_data),
      ocr_error  = _error,
      ocr_processed_at = now()
  WHERE id = _doc_id
    AND admission_id = v_admission_id;

  RETURN FOUND;
END;
$$;

-- 6) RPC para o candidato confirmar/editar os dados do OCR
CREATE OR REPLACE FUNCTION public.confirm_admission_ocr(
  _token text,
  _doc_id uuid,
  _data jsonb
) RETURNS boolean
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission_id uuid;
BEGIN
  SELECT id INTO v_admission_id FROM public.hr_admissions WHERE public_token = _token;
  IF v_admission_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.hr_admission_documents
  SET ocr_data = _data,
      ocr_status = 'confirmed',
      ocr_processed_at = now()
  WHERE id = _doc_id
    AND admission_id = v_admission_id;

  RETURN FOUND;
END;
$$;

-- 7) Atualiza seed para incluir cnh? Não — mantemos. ocr_kind é setado pelo trigger.
