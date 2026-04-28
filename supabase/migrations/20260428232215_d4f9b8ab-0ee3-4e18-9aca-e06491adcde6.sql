-- ============================================
-- DIGITAL CONTRACTS MODULE (Sales area)
-- ============================================

-- 1) Company defaults per account (CONTRATADA)
CREATE TABLE IF NOT EXISTS public.contract_company_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  company_name text,
  company_cnpj text,
  company_address text,
  company_representative text,
  company_representative_cpf text,
  company_email text,
  company_bank_info jsonb DEFAULT '{}'::jsonb,
  default_jurisdiction text,
  default_late_fee_percentage numeric DEFAULT 2,
  default_late_interest_percentage numeric DEFAULT 1,
  default_rescission_penalty_percentage numeric DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_company_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view company defaults"
  ON public.contract_company_defaults FOR SELECT
  USING (user_belongs_to_account(account_id));

CREATE POLICY "Account admins can insert company defaults"
  ON public.contract_company_defaults FOR INSERT
  WITH CHECK (user_belongs_to_account(account_id) AND is_account_owner());

CREATE POLICY "Account admins can update company defaults"
  ON public.contract_company_defaults FOR UPDATE
  USING (user_belongs_to_account(account_id) AND is_account_owner());

CREATE TRIGGER update_contract_company_defaults_updated_at
  BEFORE UPDATE ON public.contract_company_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Digital contracts
CREATE TABLE IF NOT EXISTS public.digital_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid,

  -- Metadata
  contract_number text,
  status text NOT NULL DEFAULT 'draft', -- draft | ready | pending_signature | signed | cancelled
  signed_at timestamptz,
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  zapsign_document_token text,
  signed_pdf_path text,

  -- CONTRATANTE (client)
  client_name text NOT NULL,
  client_cpf_cnpj text,
  client_address text,
  client_email text,
  client_marital_status text,
  client_nationality text DEFAULT 'brasileiro(a)',
  client_representative text,
  client_representative_cpf text,

  -- Contract terms
  object_description text,
  service_mode text DEFAULT 'hours', -- hours | deliverables
  monthly_hours integer DEFAULT 8,
  extra_hour_rate numeric DEFAULT 0,
  total_value numeric,
  down_payment_percentage numeric DEFAULT 0,
  installments integer DEFAULT 1,
  installment_value numeric,
  first_due_date date,
  due_day integer DEFAULT 10,
  contract_duration_months integer DEFAULT 12,
  has_renewal boolean DEFAULT true,
  include_witnesses boolean DEFAULT true,
  payment_method text DEFAULT 'pix_mensal',

  -- Deliverables
  deliverables jsonb DEFAULT '[]'::jsonb,

  -- Penalties / jurisdiction
  late_fee_percentage numeric DEFAULT 2,
  late_interest_percentage numeric DEFAULT 1,
  rescission_penalty_percentage numeric DEFAULT 10,
  jurisdiction text,

  -- CONTRATADA snapshot (frozen on creation from contract_company_defaults)
  company_name text,
  company_cnpj text,
  company_address text,
  company_representative text,
  company_representative_cpf text,
  company_email text,
  company_bank_info jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_digital_contracts_account ON public.digital_contracts(account_id);
CREATE INDEX idx_digital_contracts_deal ON public.digital_contracts(deal_id);
CREATE INDEX idx_digital_contracts_client ON public.digital_contracts(client_id);
CREATE INDEX idx_digital_contracts_share_token ON public.digital_contracts(share_token);
CREATE INDEX idx_digital_contracts_status ON public.digital_contracts(status);

ALTER TABLE public.digital_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view digital contracts"
  ON public.digital_contracts FOR SELECT
  USING (user_belongs_to_account(account_id));

CREATE POLICY "Account members can create digital contracts"
  ON public.digital_contracts FOR INSERT
  WITH CHECK (user_belongs_to_account(account_id));

CREATE POLICY "Account members can update digital contracts"
  ON public.digital_contracts FOR UPDATE
  USING (user_belongs_to_account(account_id));

CREATE POLICY "Account members can delete digital contracts"
  ON public.digital_contracts FOR DELETE
  USING (user_belongs_to_account(account_id));

CREATE TRIGGER update_digital_contracts_updated_at
  BEFORE UPDATE ON public.digital_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Sequential contract number per account
CREATE OR REPLACE FUNCTION public.next_digital_contract_number(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_prefix text := 'ROY-' || v_year || '-';
  v_max int;
  v_next int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(contract_number, '^' || v_prefix, ''), '')::int
  ), 0)
  INTO v_max
  FROM public.digital_contracts
  WHERE account_id = p_account_id
    AND contract_number ~ ('^' || v_prefix || '\d+$');

  v_next := v_max + 1;
  RETURN v_prefix || lpad(v_next::text, 3, '0');
END;
$$;

-- 4) Storage bucket for signed PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('digital-contracts', 'digital-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Account members can upload PDFs into their account folder
CREATE POLICY "Account members can read their digital-contracts files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'digital-contracts'
    AND user_belongs_to_account((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Account members can upload digital-contracts files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'digital-contracts'
    AND user_belongs_to_account((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Account members can update digital-contracts files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'digital-contracts'
    AND user_belongs_to_account((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "Account members can delete digital-contracts files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'digital-contracts'
    AND user_belongs_to_account((storage.foldername(name))[1]::uuid)
  );