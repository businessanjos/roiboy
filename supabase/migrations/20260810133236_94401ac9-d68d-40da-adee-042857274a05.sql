CREATE OR REPLACE FUNCTION public.tg_digital_contract_signed_release_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id uuid;
BEGIN
  IF NOT (
    (NEW.status = 'signed' OR NEW.signed_at IS NOT NULL)
    AND (
      TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.signed_at IS DISTINCT FROM NEW.signed_at
    )
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.deal_id IS NOT NULL THEN
    SELECT cc.id INTO v_contract_id
    FROM public.client_contracts cc
    WHERE cc.deal_id = NEW.deal_id
      AND cc.account_id = NEW.account_id
      AND COALESCE(cc.receivables_generated, false) = false
      AND COALESCE(cc.status, '') NOT IN ('cancelled', 'cancelado')
    ORDER BY cc.created_at DESC
    LIMIT 1;
  END IF;

  IF v_contract_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT cc.id INTO v_contract_id
    FROM public.client_contracts cc
    WHERE cc.client_id = NEW.client_id
      AND cc.account_id = NEW.account_id
      AND (NEW.product_id IS NULL OR cc.product_id IS NOT DISTINCT FROM NEW.product_id)
      AND COALESCE(cc.receivables_generated, false) = false
      AND COALESCE(cc.status, '') NOT IN ('cancelled', 'cancelado')
    ORDER BY cc.created_at DESC
    LIMIT 1;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.client_contracts
     SET receivables_generated = true,
         receivables_generated_at = now(),
         updated_at = now()
   WHERE id = v_contract_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_digital_contract_signed_release_billing ON public.digital_contracts;
CREATE TRIGGER trg_digital_contract_signed_release_billing
AFTER INSERT OR UPDATE ON public.digital_contracts
FOR EACH ROW EXECUTE FUNCTION public.tg_digital_contract_signed_release_billing();