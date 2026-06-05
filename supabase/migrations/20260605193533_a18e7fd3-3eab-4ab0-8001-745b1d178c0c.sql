ALTER TABLE public.hr_admission_documents
  ADD COLUMN IF NOT EXISTS visible_to_candidate BOOLEAN NOT NULL DEFAULT true;

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