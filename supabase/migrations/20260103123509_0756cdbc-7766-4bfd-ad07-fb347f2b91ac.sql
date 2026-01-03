-- Add companies JSONB field to clients table for multiple company/CNPJ support
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS companies jsonb DEFAULT '[]'::jsonb;

-- Add same field to leads table for consistency in the flow
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS companies jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN public.clients.companies IS 'Array of additional companies: [{"cnpj": "12.345.678/0001-90", "name": "Empresa X", "segment": "...", "niche": "..."}]';
COMMENT ON COLUMN public.leads.companies IS 'Array of additional companies: [{"cnpj": "12.345.678/0001-90", "name": "Empresa X", "segment": "...", "niche": "..."}]';

-- Update convert_lead_to_client function to include companies
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead RECORD;
  v_client_id uuid;
BEGIN
  -- Buscar lead
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  
  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;
  
  IF v_lead.converted_to_client_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido';
  END IF;
  
  -- Criar cliente com todos os dados do lead
  INSERT INTO public.clients (
    account_id, full_name, phone_e164, emails,
    cpf, rg, birth_date, cnpj, company_name,
    business_segment, business_niche, companies,
    street, street_number, complement, neighborhood, city, state, zip_code,
    business_street, business_street_number, business_complement,
    business_neighborhood, business_city, business_state, business_zip_code,
    bank_code, bank_name, bank_agency, bank_account, bank_account_type,
    pix_key, pix_key_type, instagram, instagrams,
    additional_phones, additional_pix_keys, additional_bank_accounts,
    notes, tags, responsible_user_id, status
  ) VALUES (
    v_lead.account_id, v_lead.full_name, COALESCE(v_lead.phone, '+5500000000000'),
    COALESCE(v_lead.emails, CASE WHEN v_lead.email IS NOT NULL THEN jsonb_build_array(v_lead.email) ELSE '[]'::jsonb END),
    v_lead.cpf, v_lead.rg, v_lead.birth_date, v_lead.cnpj, v_lead.company_name,
    v_lead.business_segment, v_lead.business_niche, COALESCE(v_lead.companies, '[]'::jsonb),
    v_lead.street, v_lead.street_number, v_lead.complement, v_lead.neighborhood,
    v_lead.city, v_lead.state, v_lead.zip_code,
    v_lead.business_street, v_lead.business_street_number, v_lead.business_complement,
    v_lead.business_neighborhood, v_lead.business_city, v_lead.business_state, v_lead.business_zip_code,
    v_lead.bank_code, v_lead.bank_name, v_lead.bank_agency, v_lead.bank_account, v_lead.bank_account_type,
    v_lead.pix_key, v_lead.pix_key_type, v_lead.instagram, COALESCE(v_lead.instagrams, '[]'::jsonb),
    COALESCE(v_lead.additional_phones, '[]'::jsonb),
    COALESCE(v_lead.additional_pix_keys, '[]'::jsonb),
    COALESCE(v_lead.additional_bank_accounts, '[]'::jsonb),
    v_lead.notes, COALESCE(v_lead.tags, '[]'::jsonb), v_lead.responsible_user_id, 'active'
  ) RETURNING id INTO v_client_id;
  
  -- Atualizar lead como convertido
  UPDATE public.leads
  SET converted_to_client_id = v_client_id,
      converted_at = now(),
      status = 'converted'
  WHERE id = p_lead_id;
  
  RETURN v_client_id;
END;
$function$;