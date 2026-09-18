ALTER TABLE public.spiff_spins
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_deal_id uuid;

CREATE OR REPLACE FUNCTION public.cancel_spiff_benefit_on_guarantee_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason_name text;
  v_spin RECORD;
  v_spiff_name text;
  v_user_name text;
BEGIN
  -- Só reage quando a negociação sai de "ganha" para "perdida"
  IF NEW.status <> 'lost' OR COALESCE(OLD.status, '') = 'lost' THEN
    RETURN NEW;
  END IF;
  IF NEW.won_at IS NULL OR NEW.responsible_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_reason_name FROM public.deal_loss_reasons WHERE id = NEW.loss_reason_id;

  -- Regra de garantia: desistência dentro dos 7 dias
  IF v_reason_name IS NULL OR v_reason_name NOT ILIKE '%garantia%' THEN
    RETURN NEW;
  END IF;

  -- Cancela solicitações de giro ainda pendentes do vendedor nas campanhas que cobrem a venda
  UPDATE public.spiff_spin_requests r
     SET status = 'cancelled',
         rejection_reason = COALESCE(r.rejection_reason, 'Venda cancelada na garantia (7 dias)'),
         updated_at = now()
   WHERE r.user_id = NEW.responsible_user_id
     AND r.status = 'pending'
     AND EXISTS (
       SELECT 1 FROM public.sales_spiffs s
        WHERE s.id = r.spiff_id
          AND NEW.won_at::date BETWEEN s.start_date AND s.end_date
     );

  -- Cancela o giro mais recente ainda válido do vendedor na campanha que cobre a venda
  SELECT sp.* INTO v_spin
    FROM public.spiff_spins sp
    JOIN public.sales_spiffs s ON s.id = sp.spiff_id
   WHERE sp.user_id = NEW.responsible_user_id
     AND sp.cancelled_at IS NULL
     AND NEW.won_at::date BETWEEN s.start_date AND s.end_date
   ORDER BY sp.spun_at DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.spiff_spins
       SET cancelled_at = now(),
           cancelled_reason = 'Venda cancelada na garantia (desistência em até 7 dias)',
           cancelled_deal_id = NEW.id,
           payment_status = 'cancelled'
     WHERE id = v_spin.id;

    SELECT name INTO v_spiff_name FROM public.sales_spiffs WHERE id = v_spin.spiff_id;
  END IF;

  SELECT name INTO v_user_name FROM public.users WHERE id = NEW.responsible_user_id;

  -- Avisa gestores/admins da conta
  INSERT INTO public.notifications (account_id, user_id, type, title, content, link, source_type, source_id)
  SELECT NEW.account_id,
         u.id,
         'spiff_benefit_cancelled',
         'Benefício cancelado por desistência na garantia',
         COALESCE(v_user_name, 'Vendedor') || ' teve a venda "' || COALESCE(NEW.title, 'sem título') ||
         '" cancelada dentro da garantia de 7 dias.' ||
         CASE WHEN v_spin.id IS NOT NULL
              THEN ' O giro de "' || COALESCE(v_spiff_name, 'SPIFF') || '" foi cancelado automaticamente.'
              ELSE ' Nenhum giro estava pendente de cancelamento.' END,
         '/sales-team/spiffs',
         'deal',
         NEW.id
    FROM public.users u
   WHERE u.account_id = NEW.account_id
     AND u.is_active IS DISTINCT FROM false
     AND (u.role IN ('admin', 'super_admin') OR u.is_also_admin = true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_spiff_benefit_on_guarantee_loss ON public.deals;
CREATE TRIGGER trg_cancel_spiff_benefit_on_guarantee_loss
AFTER UPDATE OF status ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.cancel_spiff_benefit_on_guarantee_loss();