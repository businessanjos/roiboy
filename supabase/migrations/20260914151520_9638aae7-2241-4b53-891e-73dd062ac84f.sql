CREATE OR REPLACE FUNCTION public.fill_client_from_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_phone text;
  v_name text;
  v_cpf text;
  v_cnpj text;
  v_company text;
  v_birth date;
  v_city text;
  v_state text;
  v_instagram text;
  v_segment text;
  v_niche text;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    SELECT
      NULLIF(TRIM(l.email), ''),
      NULLIF(TRIM(l.phone), ''),
      NULLIF(TRIM(l.full_name), ''),
      NULLIF(TRIM(l.cpf), ''),
      NULLIF(TRIM(l.cnpj), ''),
      NULLIF(TRIM(l.company_name), ''),
      l.birth_date,
      NULLIF(TRIM(l.city), ''),
      NULLIF(TRIM(l.state), ''),
      NULLIF(TRIM(l.instagram), ''),
      NULLIF(TRIM(l.business_segment), ''),
      NULLIF(TRIM(l.business_niche), '')
    INTO
      v_email, v_phone, v_name, v_cpf, v_cnpj, v_company,
      v_birth, v_city, v_state, v_instagram, v_segment, v_niche
    FROM public.leads l
    WHERE l.id = NEW.lead_id;
  END IF;

  UPDATE public.clients c
  SET
    emails = CASE
      WHEN COALESCE(jsonb_array_length(COALESCE(c.emails, '[]'::jsonb)), 0) = 0
           AND COALESCE(NULLIF(TRIM(NEW.contact_email), ''), v_email) IS NOT NULL
      THEN jsonb_build_array(COALESCE(NULLIF(TRIM(NEW.contact_email), ''), v_email))
      ELSE c.emails END,
    phone_e164 = CASE
      WHEN (c.phone_e164 IS NULL OR TRIM(c.phone_e164) = '' OR c.phone_e164 = '+5500000000000')
           AND COALESCE(NULLIF(TRIM(NEW.contact_phone), ''), v_phone) IS NOT NULL
      THEN COALESCE(NULLIF(TRIM(NEW.contact_phone), ''), v_phone)
      ELSE c.phone_e164 END,
    full_name = COALESCE(NULLIF(TRIM(c.full_name), ''), NULLIF(TRIM(NEW.contact_name), ''), v_name),
    cpf = COALESCE(NULLIF(TRIM(c.cpf), ''), v_cpf),
    cnpj = COALESCE(NULLIF(TRIM(c.cnpj), ''), v_cnpj),
    company_name = COALESCE(NULLIF(TRIM(c.company_name), ''), v_company),
    birth_date = COALESCE(c.birth_date, v_birth),
    city = COALESCE(NULLIF(TRIM(c.city), ''), v_city),
    state = COALESCE(NULLIF(TRIM(c.state), ''), v_state),
    instagram = COALESCE(NULLIF(TRIM(c.instagram), ''), v_instagram),
    business_segment = COALESCE(NULLIF(TRIM(c.business_segment), ''), v_segment),
    business_niche = COALESCE(NULLIF(TRIM(c.business_niche), ''), v_niche)
  WHERE c.id = NEW.client_id;

  RETURN NEW;
END;
$function$;