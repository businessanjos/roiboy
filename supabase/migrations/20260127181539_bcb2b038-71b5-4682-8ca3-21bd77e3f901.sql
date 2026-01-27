-- Adicionar coluna para vendedor responsável
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS sales_user_id uuid REFERENCES public.users(id);

-- Comentários explicativos
COMMENT ON COLUMN public.clients.sales_user_id IS 'Vendedor que fechou a venda (setor Vendas)';
COMMENT ON COLUMN public.clients.responsible_user_id IS 'Consultor responsável pelo atendimento (setor Operações)';

-- Atualizar função convert_lead_to_client para NÃO copiar responsible_user_id
CREATE OR REPLACE FUNCTION public.convert_lead_to_client(p_lead_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Criar cliente SEM responsible_user_id (vai para triagem da Operação)
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
    notes, tags, status
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
    v_lead.notes, COALESCE(v_lead.tags, '[]'::jsonb), 'active'
  ) RETURNING id INTO v_client_id;
  
  -- Atualizar lead como convertido
  UPDATE public.leads
  SET converted_to_client_id = v_client_id,
      converted_at = now(),
      status = 'converted'
  WHERE id = p_lead_id;
  
  RETURN v_client_id;
END;
$$;