
CREATE OR REPLACE FUNCTION public.handle_contract_cancellation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  NEW.payment_status := 'cancelado';
  NEW.payment_status_updated_at := now();

  FOR v_inst IN
    SELECT i.* FROM public.installments i
    JOIN public.invoices inv ON inv.id = i.invoice_id
    WHERE (inv.contract_id = NEW.id OR (NEW.deal_id IS NOT NULL AND inv.deal_id = NEW.deal_id))
      AND i.status IN ('pending','scheduled','overdue')
  LOOP
    UPDATE public.installments
       SET status = 'written_off',
           notes = COALESCE(notes || E'\n', '') || 'Write-off por cancelamento: ' || v_reason,
           updated_at = now()
     WHERE id = v_inst.id;

    INSERT INTO public.installment_events
      (account_id, invoice_id, installment_id, event_type, payload, visible_to)
    VALUES
      (NEW.account_id, v_inst.invoice_id, v_inst.id, 'cancellation_writeoff',
       jsonb_build_object(
         'description', 'Parcela baixada por cancelamento de contrato: ' || v_reason,
         'contract_id', NEW.id,
         'reason', v_reason
       ),
       'all');
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_invoice_settlement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total int;
  v_paid int;
  v_invoice invoices%ROWTYPE;
  v_contract_id uuid;
  v_contract_invoices_total int;
  v_contract_invoices_settled int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = NEW.invoice_id;
  IF NOT FOUND OR v_invoice.status = 'settled' THEN
    RETURN NEW;
  END IF;

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
      (account_id, invoice_id, installment_id, event_type, payload, visible_to)
    VALUES
      (NEW.account_id, NEW.invoice_id, NEW.id, 'invoice_settled',
       jsonb_build_object('description', 'Fatura quitada automaticamente — todas as parcelas pagas'),
       'all');

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
            (account_id, invoice_id, installment_id, event_type, payload, visible_to)
          VALUES
            (NEW.account_id, NEW.invoice_id, NEW.id, 'contract_settled',
             jsonb_build_object('description', 'Contrato totalmente quitado — pronto para renovação'),
             'all');
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
