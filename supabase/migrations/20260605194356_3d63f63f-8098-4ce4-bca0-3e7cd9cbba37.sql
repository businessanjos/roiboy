
ALTER TABLE public.hr_admission_documents
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS form_schema JSONB,
  ADD COLUMN IF NOT EXISTS form_data JSONB;

-- Default bank schema for any existing "conta_bancaria" doc
UPDATE public.hr_admission_documents
SET doc_type = 'form',
    form_schema = COALESCE(form_schema, '[
      {"key":"banco","label":"Banco","type":"text","required":true,"placeholder":"Ex.: Itaú, Nubank"},
      {"key":"agencia","label":"Agência","type":"text","required":true,"placeholder":"0000"},
      {"key":"conta","label":"Conta (com dígito)","type":"text","required":true,"placeholder":"00000-0"},
      {"key":"tipo_conta","label":"Tipo de conta","type":"select","required":true,"options":["Conta Corrente","Conta Poupança","Conta Salário"]},
      {"key":"titular","label":"Nome do titular","type":"text","required":true},
      {"key":"cpf_titular","label":"CPF do titular","type":"text","required":true,"placeholder":"000.000.000-00"},
      {"key":"pix","label":"Chave PIX (opcional)","type":"text","required":false,"placeholder":"CPF, e-mail, telefone ou aleatória"}
    ]'::jsonb)
WHERE doc_key = 'conta_bancaria';

-- Update portal RPC to expose new fields
CREATE OR REPLACE FUNCTION public.get_admission_portal(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'form_data', d.form_data
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
$function$;

-- Submission RPC for form-type docs (called from public portal via edge function)
CREATE OR REPLACE FUNCTION public.submit_admission_form(
  _token text,
  _doc_id uuid,
  _form_data jsonb
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admission_id uuid;
BEGIN
  SELECT a.id INTO v_admission_id
  FROM public.hr_admissions a
  WHERE a.public_token = _token
    AND (a.token_expires_at IS NULL OR a.token_expires_at > now());
  IF v_admission_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.hr_admission_documents
  SET form_data = _form_data,
      status = 'received',
      uploaded_at = now(),
      uploaded_via = 'candidate',
      notes = NULL
  WHERE id = _doc_id
    AND admission_id = v_admission_id
    AND COALESCE(doc_type, 'file') = 'form';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.hr_admissions SET updated_at = now() WHERE id = v_admission_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_admission_form(text, uuid, jsonb) TO anon, authenticated, service_role;
