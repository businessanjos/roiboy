
-- 1) Coluna de múltiplos anexos
ALTER TABLE public.hr_admission_documents
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: migra o arquivo único existente para o array
UPDATE public.hr_admission_documents
SET attachments = jsonb_build_array(jsonb_build_object(
  'name', file_name,
  'url', file_url,
  'path', NULL,
  'uploaded_at', COALESCE(uploaded_at, now()),
  'uploaded_via', COALESCE(uploaded_via, 'rh')
))
WHERE file_url IS NOT NULL
  AND (attachments IS NULL OR attachments = '[]'::jsonb);

-- 2) get_admission_portal devolve também attachments
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
    'attachments', COALESCE(d.attachments, '[]'::jsonb),
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

-- 3) submit_admission_doc passa a anexar (não substituir)
CREATE OR REPLACE FUNCTION public.submit_admission_doc(
  _token TEXT,
  _doc_id UUID,
  _file_url TEXT,
  _file_name TEXT,
  _path TEXT DEFAULT NULL
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
  IF v_admission_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RAISE EXCEPTION 'Link expirado'; END IF;

  UPDATE public.hr_admission_documents
  SET status = 'received',
      file_url = _file_url,
      file_name = _file_name,
      uploaded_at = now(),
      uploaded_via = 'candidate',
      notes = NULL,
      attachments = COALESCE(attachments, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'name', _file_name,
        'url', _file_url,
        'path', _path,
        'uploaded_at', now(),
        'uploaded_via', 'candidate'
      ))
  WHERE id = _doc_id AND admission_id = v_admission_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated > 0 THEN
    UPDATE public.hr_admissions SET updated_at = now() WHERE id = v_admission_id;
  END IF;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_admission_doc(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_admission_doc(TEXT, UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4) Remove um anexo específico do candidato
CREATE OR REPLACE FUNCTION public.delete_admission_doc_attachment(
  _token TEXT,
  _doc_id UUID,
  _path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admission_id UUID;
  v_expires TIMESTAMPTZ;
  v_new JSONB;
  v_last JSONB;
BEGIN
  SELECT id, token_expires_at INTO v_admission_id, v_expires
  FROM public.hr_admissions WHERE public_token = _token;
  IF v_admission_id IS NULL THEN RAISE EXCEPTION 'Token inválido'; END IF;
  IF v_expires IS NOT NULL AND v_expires < now() THEN RAISE EXCEPTION 'Link expirado'; END IF;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    INTO v_new
  FROM public.hr_admission_documents d,
       jsonb_array_elements(COALESCE(d.attachments, '[]'::jsonb)) elem
  WHERE d.id = _doc_id
    AND d.admission_id = v_admission_id
    AND COALESCE(elem->>'path', '') <> COALESCE(_path, '');

  v_last := CASE WHEN jsonb_array_length(v_new) > 0
                 THEN v_new -> (jsonb_array_length(v_new) - 1)
                 ELSE NULL END;

  UPDATE public.hr_admission_documents
  SET attachments = v_new,
      file_url   = v_last->>'url',
      file_name  = v_last->>'name',
      uploaded_at = CASE WHEN v_last IS NULL THEN NULL ELSE now() END,
      status     = CASE WHEN v_last IS NULL THEN 'pending'
                        WHEN status = 'approved' THEN 'received'
                        ELSE status END
  WHERE id = _doc_id AND admission_id = v_admission_id;

  UPDATE public.hr_admissions SET updated_at = now() WHERE id = v_admission_id;

  RETURN jsonb_build_object('ok', true, 'remaining', jsonb_array_length(v_new));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_admission_doc_attachment(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_admission_doc_attachment(TEXT, UUID, TEXT) TO anon, authenticated, service_role;
