-- =========================
-- Sprint NF-1: NFS-e (Notazz)
-- =========================

CREATE TABLE IF NOT EXISTS public.contratadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  cnpj TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  inscricao_municipal TEXT,
  inscricao_estadual TEXT,
  endereco JSONB DEFAULT '{}'::jsonb,
  regime_tributario TEXT NOT NULL DEFAULT 'simples_nacional'
    CHECK (regime_tributario IN ('simples_nacional','lucro_presumido','lucro_real','mei')),
  item_lista_servico TEXT,
  codigo_tributacao_municipio TEXT,
  aliquota_iss NUMERIC(5,2),
  provider TEXT NOT NULL DEFAULT 'notazz'
    CHECK (provider IN ('notazz','focus_nfe','manual')),
  provider_config JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, cnpj)
);

CREATE INDEX IF NOT EXISTS idx_contratadas_account ON public.contratadas(account_id) WHERE active;
ALTER TABLE public.contratadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratadas_select" ON public.contratadas FOR SELECT USING (account_id = public.get_user_account_id());
CREATE POLICY "contratadas_insert" ON public.contratadas FOR INSERT WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "contratadas_update" ON public.contratadas FOR UPDATE USING (account_id = public.get_user_account_id());
CREATE POLICY "contratadas_delete" ON public.contratadas FOR DELETE USING (account_id = public.get_user_account_id());

CREATE TRIGGER trg_contratadas_updated
  BEFORE UPDATE ON public.contratadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.nfse_issuances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  contratada_id UUID NOT NULL REFERENCES public.contratadas(id) ON DELETE RESTRICT,
  payer_id UUID REFERENCES public.payers(id) ON DELETE SET NULL,
  client_id UUID,
  source_type TEXT NOT NULL CHECK (source_type IN ('installment','invoice','manual')),
  source_id UUID,
  invoice_id UUID,
  installment_id UUID,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  item_lista_servico TEXT,
  codigo_tributacao_municipio TEXT,
  aliquota_iss NUMERIC(5,2),
  iss_retido BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'notazz',
  provider_request_id TEXT,
  provider_response JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','queued','processing','issued','rejected','cancelled')),
  rps_series TEXT,
  rps_number TEXT,
  nfse_number TEXT,
  verification_code TEXT,
  pdf_url TEXT,
  xml_url TEXT,
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  rejected_reason TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nfse_account_status ON public.nfse_issuances(account_id, status);
CREATE INDEX IF NOT EXISTS idx_nfse_installment ON public.nfse_issuances(installment_id) WHERE installment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nfse_invoice ON public.nfse_issuances(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nfse_client ON public.nfse_issuances(client_id) WHERE client_id IS NOT NULL;

ALTER TABLE public.nfse_issuances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nfse_select" ON public.nfse_issuances FOR SELECT USING (account_id = public.get_user_account_id());
CREATE POLICY "nfse_insert" ON public.nfse_issuances FOR INSERT WITH CHECK (account_id = public.get_user_account_id());
CREATE POLICY "nfse_update" ON public.nfse_issuances FOR UPDATE USING (account_id = public.get_user_account_id());
CREATE POLICY "nfse_delete" ON public.nfse_issuances FOR DELETE USING (account_id = public.get_user_account_id());

CREATE TRIGGER trg_nfse_issuances_updated
  BEFORE UPDATE ON public.nfse_issuances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS nfse_emission_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (nfse_emission_mode IN ('manual','on_payment','on_won')),
  ADD COLUMN IF NOT EXISTS nfse_auto_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nfse_default_contratada_id UUID;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS nfse_item_lista_servico TEXT,
  ADD COLUMN IF NOT EXISTS nfse_codigo_tributacao_municipio TEXT,
  ADD COLUMN IF NOT EXISTS nfse_aliquota_iss NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS nfse_description_template TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fiscal-docs', 'fiscal-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fiscal_docs_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fiscal-docs'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );
CREATE POLICY "fiscal_docs_write" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fiscal-docs'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );
CREATE POLICY "fiscal_docs_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fiscal-docs'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );
CREATE POLICY "fiscal_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fiscal-docs'
    AND (storage.foldername(name))[1] = public.get_user_account_id()::text
  );

-- Trigger: cria NFS-e pendente quando parcela é paga (modo on_payment)
CREATE OR REPLACE FUNCTION public.trg_nfse_on_installment_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_mode TEXT;
  v_default_contratada UUID;
  v_invoice RECORD;
  v_existing UUID;
  v_description TEXT;
  v_item_lista TEXT;
  v_codigo_trib TEXT;
  v_aliquota NUMERIC(5,2);
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid'
     AND COALESCE(NEW.payment_status,'') NOT IN ('pix_confirmado','boleto_pago','cartao_capturado','cheque_recebido')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND COALESCE(OLD.payment_status,'') = COALESCE(NEW.payment_status,'')
  THEN
    RETURN NEW;
  END IF;

  SELECT i.id, i.account_id, i.payer_id, i.client_id, i.description, i.product_id
    INTO v_invoice
  FROM public.invoices i
  WHERE i.id = NEW.invoice_id;

  IF v_invoice.id IS NULL THEN RETURN NEW; END IF;
  v_account_id := v_invoice.account_id;

  SELECT nfse_emission_mode, nfse_default_contratada_id
    INTO v_mode, v_default_contratada
  FROM public.account_settings
  WHERE account_id = v_account_id;

  IF v_mode IS DISTINCT FROM 'on_payment' THEN RETURN NEW; END IF;
  IF v_default_contratada IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_existing FROM public.nfse_issuances WHERE installment_id = NEW.id LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN NEW; END IF;

  IF v_invoice.product_id IS NOT NULL THEN
    SELECT nfse_item_lista_servico, nfse_codigo_tributacao_municipio, nfse_aliquota_iss,
           COALESCE(nfse_description_template, v_invoice.description)
      INTO v_item_lista, v_codigo_trib, v_aliquota, v_description
    FROM public.products WHERE id = v_invoice.product_id;
  END IF;

  v_description := COALESCE(v_description, v_invoice.description, 'Serviços prestados');

  INSERT INTO public.nfse_issuances (
    account_id, contratada_id, payer_id, client_id,
    source_type, source_id, invoice_id, installment_id,
    amount, description, item_lista_servico, codigo_tributacao_municipio,
    aliquota_iss, status
  ) VALUES (
    v_account_id, v_default_contratada, v_invoice.payer_id, v_invoice.client_id,
    'installment', NEW.id, NEW.invoice_id, NEW.id,
    NEW.amount, v_description, v_item_lista, v_codigo_trib,
    v_aliquota, 'pending'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nfse_auto_on_installment_paid ON public.installments;
CREATE TRIGGER trg_nfse_auto_on_installment_paid
  AFTER INSERT OR UPDATE OF status, payment_status, paid_at
  ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_nfse_on_installment_paid();