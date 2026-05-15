
-- 1. Status detalhado de pagamento por método
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS payment_status text,
  ADD COLUMN IF NOT EXISTS payment_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS renegotiated_from_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS renegotiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS renegotiation_reason text;

CREATE INDEX IF NOT EXISTS idx_installments_renegotiated_from ON public.installments(renegotiated_from_id);
CREATE INDEX IF NOT EXISTS idx_installments_payment_status ON public.installments(payment_status);

COMMENT ON COLUMN public.installments.payment_status IS 'Status granular por método: cheque_enviado, cheque_pendente, cheque_recebido, cheque_devolvido, boleto_emitido, boleto_registrado, boleto_pago, cartao_autorizado, cartao_capturado, cartao_estornado, pix_aguardando, pix_confirmado, transferencia_pendente, transferencia_confirmada';

-- 2. Trigger para registrar mudanças de payment_status em installment_events
CREATE OR REPLACE FUNCTION public.log_installment_payment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.payment_status,'') IS DISTINCT FROM COALESCE(OLD.payment_status,'') THEN
    NEW.payment_status_updated_at := now();
    INSERT INTO public.installment_events (
      account_id, installment_id, invoice_id, event_type, payload, visible_to, created_by
    ) VALUES (
      NEW.account_id, NEW.id, NEW.invoice_id, 'payment_status_changed',
      jsonb_build_object(
        'from', OLD.payment_status,
        'to', NEW.payment_status,
        'payment_method', NEW.payment_method
      ),
      'internal', auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installment_payment_status_change ON public.installments;
CREATE TRIGGER trg_installment_payment_status_change
BEFORE UPDATE ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.log_installment_payment_status_change();

-- 3. Trava global de exclusão (com bypass admin via session var)
CREATE OR REPLACE FUNCTION public.block_financial_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.allow_financial_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Exclusão bloqueada em %: use renegociação, baixa, perda ou cancelamento. Para forçar, defina app.allow_financial_delete=true na sessão.', TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_delete_installments ON public.installments;
CREATE TRIGGER trg_block_delete_installments
BEFORE DELETE ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.block_financial_delete();

DROP TRIGGER IF EXISTS trg_block_delete_invoices ON public.invoices;
CREATE TRIGGER trg_block_delete_invoices
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.block_financial_delete();

DROP TRIGGER IF EXISTS trg_block_delete_client_contracts ON public.client_contracts;
CREATE TRIGGER trg_block_delete_client_contracts
BEFORE DELETE ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.block_financial_delete();

-- 4. RPC para renegociar uma parcela: marca original e cria N novas
CREATE OR REPLACE FUNCTION public.renegotiate_installment(
  p_installment_id uuid,
  p_reason text,
  p_new_installments jsonb -- array of { due_date, amount, payment_method }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original public.installments%ROWTYPE;
  v_item jsonb;
  v_max_number int;
  v_new_ids uuid[] := ARRAY[]::uuid[];
  v_new_id uuid;
BEGIN
  SELECT * INTO v_original FROM public.installments WHERE id = p_installment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;
  IF v_original.status = 'paid' THEN
    RAISE EXCEPTION 'Parcela já paga não pode ser renegociada';
  END IF;
  IF jsonb_array_length(p_new_installments) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma nova parcela';
  END IF;

  -- Marca original como renegociada
  UPDATE public.installments
  SET status = 'renegotiated',
      renegotiated_at = now(),
      renegotiation_reason = p_reason,
      updated_at = now()
  WHERE id = p_installment_id;

  SELECT COALESCE(MAX(number),0) INTO v_max_number
  FROM public.installments WHERE invoice_id = v_original.invoice_id;

  -- Cria novas parcelas
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_new_installments) LOOP
    v_max_number := v_max_number + 1;
    INSERT INTO public.installments (
      account_id, invoice_id, number, due_date, amount, payment_method,
      status, renegotiated_from_id, created_by, notes
    ) VALUES (
      v_original.account_id,
      v_original.invoice_id,
      v_max_number,
      (v_item->>'due_date')::date,
      (v_item->>'amount')::numeric,
      COALESCE(v_item->>'payment_method', v_original.payment_method),
      'pending',
      v_original.id,
      auth.uid(),
      'Renegociada de parcela #' || v_original.number
    ) RETURNING id INTO v_new_id;
    v_new_ids := array_append(v_new_ids, v_new_id);
  END LOOP;

  -- Evento na original
  INSERT INTO public.installment_events (
    account_id, installment_id, invoice_id, event_type, payload, visible_to, created_by
  ) VALUES (
    v_original.account_id, v_original.id, v_original.invoice_id, 'renegotiated',
    jsonb_build_object(
      'reason', p_reason,
      'new_installment_ids', to_jsonb(v_new_ids),
      'new_count', array_length(v_new_ids,1)
    ),
    'internal', auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'new_installment_ids', to_jsonb(v_new_ids));
END;
$$;

GRANT EXECUTE ON FUNCTION public.renegotiate_installment(uuid, text, jsonb) TO authenticated;
