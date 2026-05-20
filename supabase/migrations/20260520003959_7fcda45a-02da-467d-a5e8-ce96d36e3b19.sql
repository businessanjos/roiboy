
-- =========================================================================
-- SPRINT 1 + 4 — Pagador + Operação ↔ Financeiro
-- =========================================================================

-- 1) Settings: feature flag pagador + bloqueio inadimplência
ALTER TABLE public.account_settings
  ADD COLUMN IF NOT EXISTS payer_required_in_won boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_overdue_days integer;

-- 2) Cliente: exceção de bloqueio por inadimplência
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS overdue_exception_until date;

-- 3) Contrato: status de pagamento separado do status do contrato
ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS payment_status_updated_at timestamp with time zone;

ALTER TABLE public.client_contracts
  DROP CONSTRAINT IF EXISTS client_contracts_payment_status_check;
ALTER TABLE public.client_contracts
  ADD CONSTRAINT client_contracts_payment_status_check
  CHECK (payment_status IN ('ativo','quitado','inadimplente','cancelado','renegociado'));

CREATE INDEX IF NOT EXISTS idx_client_contracts_payment_status
  ON public.client_contracts(payment_status);

-- 4) Novos tipos de eventos
ALTER TABLE public.installment_events
  DROP CONSTRAINT IF EXISTS installment_events_event_type_check;
ALTER TABLE public.installment_events
  ADD CONSTRAINT installment_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'note','charge_attempt','message_sent','promise','renegotiation','dispute','judicial',
    'bounce','partial_payment','full_payment','discount','write_off','status_change',
    'check_status_change','card_status_change','lock','unlock','system',
    'invoice_settled','contract_settled','cancellation_writeoff'
  ]));

-- 5) RPC: garantir payer self a partir do cliente
CREATE OR REPLACE FUNCTION public.ensure_payer_from_client(p_client_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client clients%ROWTYPE;
  v_payer_id uuid;
  v_doc text;
  v_doc_type text;
  v_existing_payer_id uuid;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado: %', p_client_id;
  END IF;

  -- Já tem payer default vinculado?
  SELECT cp.payer_id INTO v_existing_payer_id
  FROM public.client_payers cp
  WHERE cp.client_id = p_client_id AND cp.is_default = true
  LIMIT 1;
  IF v_existing_payer_id IS NOT NULL THEN
    RETURN v_existing_payer_id;
  END IF;

  -- Resolver documento
  v_doc := regexp_replace(COALESCE(v_client.cpf_cnpj,''), '[^0-9]', '', 'g');
  IF length(v_doc) = 11 THEN
    v_doc_type := 'cpf';
  ELSIF length(v_doc) = 14 THEN
    v_doc_type := 'cnpj';
  ELSE
    RAISE EXCEPTION 'Cliente sem CPF/CNPJ válido — preencha o documento antes de criar pagador';
  END IF;

  -- Existe payer com mesmo documento no account?
  SELECT id INTO v_payer_id
  FROM public.payers
  WHERE account_id = v_client.account_id AND document = v_doc
  LIMIT 1;

  IF v_payer_id IS NULL THEN
    INSERT INTO public.payers (account_id, document_type, document, legal_name, email_billing, phone_billing)
    VALUES (
      v_client.account_id, v_doc_type, v_doc,
      COALESCE(v_client.name, 'Pagador'),
      CASE WHEN v_client.emails IS NOT NULL AND array_length(v_client.emails,1) > 0
           THEN v_client.emails[1] ELSE NULL END,
      v_client.phone
    )
    RETURNING id INTO v_payer_id;
  END IF;

  -- Vincular como default
  INSERT INTO public.client_payers (account_id, client_id, payer_id, relationship, is_default)
  VALUES (v_client.account_id, p_client_id, v_payer_id, 'self', true)
  ON CONFLICT (client_id, payer_id) DO UPDATE SET is_default = true;

  RETURN v_payer_id;
END;
$$;

-- 6) Trigger: quitação automática de invoice + contrato
CREATE OR REPLACE FUNCTION public.check_invoice_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_paid int;
  v_invoice invoices%ROWTYPE;
  v_contract_id uuid;
  v_contract_invoices_total int;
  v_contract_invoices_settled int;
BEGIN
  -- Só processa se status realmente mudou para um terminal de pagamento
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = NEW.invoice_id;
  IF NOT FOUND OR v_invoice.status = 'settled' THEN
    RETURN NEW;
  END IF;

  -- Conta parcelas
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE status = 'paid'
         OR payment_status IN ('cheque_recebido','pix_confirmado','boleto_pago','cartao_capturado')
    )
  INTO v_total, v_paid
  FROM public.installments WHERE invoice_id = NEW.invoice_id;

  IF v_total > 0 AND v_paid = v_total THEN
    UPDATE public.invoices
       SET status = 'settled', closed_at = now(), updated_at = now()
     WHERE id = NEW.invoice_id;

    INSERT INTO public.installment_events
      (account_id, invoice_id, installment_id, event_type, description, visible_to)
    VALUES
      (NEW.account_id, NEW.invoice_id, NEW.id, 'invoice_settled',
       'Fatura quitada automaticamente — todas as parcelas pagas', 'all');

    -- Propaga para contrato (via deal_id → client_contracts.deal_id)
    IF v_invoice.deal_id IS NOT NULL THEN
      SELECT id INTO v_contract_id FROM public.client_contracts
       WHERE deal_id = v_invoice.deal_id LIMIT 1;

      IF v_contract_id IS NOT NULL THEN
        SELECT
          COUNT(*),
          COUNT(*) FILTER (WHERE status = 'settled')
        INTO v_contract_invoices_total, v_contract_invoices_settled
        FROM public.invoices
        WHERE deal_id = v_invoice.deal_id;

        IF v_contract_invoices_total > 0
           AND v_contract_invoices_settled = v_contract_invoices_total THEN
          UPDATE public.client_contracts
             SET payment_status = 'quitado',
                 payment_status_updated_at = now(),
                 updated_at = now()
           WHERE id = v_contract_id AND payment_status <> 'quitado';

          INSERT INTO public.installment_events
            (account_id, invoice_id, installment_id, event_type, description, visible_to)
          VALUES
            (NEW.account_id, NEW.invoice_id, NEW.id, 'contract_settled',
             'Contrato totalmente quitado — pronto para renovação', 'all');
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_invoice_settlement ON public.installments;
CREATE TRIGGER trg_check_invoice_settlement
AFTER INSERT OR UPDATE OF status, payment_status, paid_at ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_settlement();

-- 7) Trigger: cancelamento de contrato → write-off proporcional
CREATE OR REPLACE FUNCTION public.handle_contract_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
  v_inst record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('cancelled','dismissal_termination','dropout_7d') THEN
    RETURN NEW;
  END IF;

  v_reason := COALESCE(NEW.cancellation_reason, NEW.status_reason, 'Contrato cancelado');

  -- Marca payment_status
  NEW.payment_status := 'cancelado';
  NEW.payment_status_updated_at := now();

  -- Write-off em parcelas futuras
  IF NEW.deal_id IS NOT NULL THEN
    FOR v_inst IN
      SELECT i.* FROM public.installments i
      JOIN public.invoices inv ON inv.id = i.invoice_id
      WHERE inv.deal_id = NEW.deal_id
        AND i.status IN ('pending','scheduled','overdue')
    LOOP
      UPDATE public.installments
         SET status = 'written_off',
             notes = COALESCE(notes || E'\n', '') || 'Write-off por cancelamento: ' || v_reason,
             updated_at = now()
       WHERE id = v_inst.id;

      INSERT INTO public.installment_events
        (account_id, invoice_id, installment_id, event_type, description, visible_to, metadata)
      VALUES
        (NEW.account_id, v_inst.invoice_id, v_inst.id, 'cancellation_writeoff',
         'Parcela baixada por cancelamento de contrato: ' || v_reason, 'all',
         jsonb_build_object('contract_id', NEW.id, 'reason', v_reason));
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_contract_cancellation ON public.client_contracts;
CREATE TRIGGER trg_handle_contract_cancellation
BEFORE UPDATE OF status ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.handle_contract_cancellation();

-- 8) RPC helper para UI: resumo de inadimplência por cliente
CREATE OR REPLACE FUNCTION public.get_client_overdue_summary(p_client_id uuid)
RETURNS TABLE (
  overdue_count int,
  overdue_amount numeric,
  oldest_due_date date,
  days_overdue int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int AS overdue_count,
    COALESCE(SUM(i.amount), 0)::numeric AS overdue_amount,
    MIN(i.due_date) AS oldest_due_date,
    COALESCE((CURRENT_DATE - MIN(i.due_date)), 0)::int AS days_overdue
  FROM public.installments i
  JOIN public.invoices inv ON inv.id = i.invoice_id
  WHERE inv.client_id = p_client_id
    AND i.status IN ('pending','scheduled','overdue')
    AND i.due_date < CURRENT_DATE;
$$;
