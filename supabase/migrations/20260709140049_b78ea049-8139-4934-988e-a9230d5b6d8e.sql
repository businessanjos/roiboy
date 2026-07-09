CREATE OR REPLACE FUNCTION public.ensure_payer_from_client(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client clients%ROWTYPE;
  v_payer_id uuid;
  v_doc text;
  v_doc_type text;
  v_existing_payer_id uuid;
  v_email text;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
  END IF;

  SELECT cp.payer_id INTO v_existing_payer_id
  FROM public.client_payers cp
  WHERE cp.client_id = p_client_id AND cp.is_default = true
  LIMIT 1;
  IF v_existing_payer_id IS NOT NULL THEN
    RETURN v_existing_payer_id;
  END IF;

  v_doc := regexp_replace(COALESCE(NULLIF(v_client.cnpj,''), v_client.cpf, ''), '[^0-9]', '', 'g');
  IF length(v_doc) = 11 THEN
    v_doc_type := 'cpf';
  ELSIF length(v_doc) = 14 THEN
    v_doc_type := 'cnpj';
  ELSE
    RAISE EXCEPTION 'Cliente sem CPF/CNPJ válido — preencha o documento antes de criar pagador';
  END IF;

  -- extrai primeiro e-mail: suporta jsonb array, jsonb string, ou fallback null
  BEGIN
    IF v_client.emails IS NOT NULL THEN
      IF jsonb_typeof(v_client.emails::jsonb) = 'array' AND jsonb_array_length(v_client.emails::jsonb) > 0 THEN
        v_email := v_client.emails::jsonb ->> 0;
      ELSIF jsonb_typeof(v_client.emails::jsonb) = 'string' THEN
        v_email := v_client.emails::jsonb #>> '{}';
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    v_email := NULL;
  END;

  SELECT id INTO v_payer_id
  FROM public.payers
  WHERE account_id = v_client.account_id AND document = v_doc
  LIMIT 1;

  IF v_payer_id IS NULL THEN
    INSERT INTO public.payers (account_id, document_type, document, legal_name, email_billing, phone_billing)
    VALUES (v_client.account_id, v_doc_type, v_doc, COALESCE(v_client.full_name, 'Pagador'), v_email, v_client.phone)
    RETURNING id INTO v_payer_id;
  END IF;

  INSERT INTO public.client_payers (account_id, client_id, payer_id, relationship, is_default)
  VALUES (v_client.account_id, p_client_id, v_payer_id, 'self', true)
  ON CONFLICT (client_id, payer_id) DO UPDATE SET is_default = true;

  RETURN v_payer_id;
END;
$function$;