
ALTER TABLE public.hr_admission_documents
  ADD COLUMN IF NOT EXISTS uploaded_via TEXT;

CREATE OR REPLACE FUNCTION public.get_admission_portal(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
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
    'notes', d.notes,
    'sort_order', d.sort_order
  ) ORDER BY d.sort_order), '[]'::jsonb)
  INTO v_docs
  FROM public.hr_admission_documents d
  WHERE d.admission_id = v_admission.id;

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

CREATE OR REPLACE FUNCTION public.submit_admission_doc(
  _token TEXT,
  _doc_id UUID,
  _file_url TEXT,
  _file_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission_id UUID;
  v_expires TIMESTAMPTZ;
  v_updated INT;
BEGIN
  SELECT id, token_expires_at INTO v_admission_id, v_expires
  FROM public.hr_admissions WHERE public_token = _token;

  IF v_admission_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RAISE EXCEPTION 'Link expirado';
  END IF;

  UPDATE public.hr_admission_documents
  SET status = 'received',
      file_url = _file_url,
      file_name = _file_name,
      uploaded_at = now(),
      uploaded_via = 'candidate',
      notes = NULL  -- limpa motivo de rejeição anterior
  WHERE id = _doc_id AND admission_id = v_admission_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    UPDATE public.hr_admissions SET updated_at = now() WHERE id = v_admission_id;
  END IF;

  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_admission_doc(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_admission_doc(TEXT, UUID, TEXT, TEXT) TO anon, authenticated, service_role;
