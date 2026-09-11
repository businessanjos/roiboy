CREATE OR REPLACE FUNCTION public.fill_client_from_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
  END IF;

  UPDATE public.clients c
  SET
    emails = CASE
      WHEN COALESCE(jsonb_array_length(COALESCE(c.emails, '[]'::jsonb)), 0) = 0
           AND COALESCE(NULLIF(TRIM(NEW.contact_email), ''), NULLIF(TRIM(v_lead.email), '')) IS NOT NULL
      THEN jsonb_build_array(COALESCE(NULLIF(TRIM(NEW.contact_email), ''), NULLIF(TRIM(v_lead.email), '')))
      ELSE c.emails END,
    phone_e164 = CASE
      WHEN (c.phone_e164 IS NULL OR TRIM(c.phone_e164) = '' OR c.phone_e164 = '+5500000000000')
           AND COALESCE(NULLIF(TRIM(NEW.contact_phone), ''), NULLIF(TRIM(v_lead.phone), '')) IS NOT NULL
      THEN COALESCE(NULLIF(TRIM(NEW.contact_phone), ''), NULLIF(TRIM(v_lead.phone), ''))
      ELSE c.phone_e164 END,
    full_name = COALESCE(NULLIF(TRIM(c.full_name), ''), NULLIF(TRIM(NEW.contact_name), ''), NULLIF(TRIM(v_lead.full_name), '')),
    cpf = COALESCE(NULLIF(TRIM(c.cpf), ''), NULLIF(TRIM(v_lead.cpf), '')),
    cnpj = COALESCE(NULLIF(TRIM(c.cnpj), ''), NULLIF(TRIM(v_lead.cnpj), '')),
    company_name = COALESCE(NULLIF(TRIM(c.company_name), ''), NULLIF(TRIM(v_lead.company_name), '')),
    birth_date = COALESCE(c.birth_date, v_lead.birth_date),
    city = COALESCE(NULLIF(TRIM(c.city), ''), NULLIF(TRIM(v_lead.city), '')),
    state = COALESCE(NULLIF(TRIM(c.state), ''), NULLIF(TRIM(v_lead.state), '')),
    instagram = COALESCE(NULLIF(TRIM(c.instagram), ''), NULLIF(TRIM(v_lead.instagram), '')),
    business_segment = COALESCE(NULLIF(TRIM(c.business_segment), ''), NULLIF(TRIM(v_lead.business_segment), '')),
    business_niche = COALESCE(NULLIF(TRIM(c.business_niche), ''), NULLIF(TRIM(v_lead.business_niche), ''))
  WHERE c.id = NEW.client_id;

  RETURN NEW;
END;
$$;