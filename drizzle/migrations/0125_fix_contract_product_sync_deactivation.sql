-- 1) Sincronização contrato -> produto: só insere quando o vínculo ainda não existe
CREATE OR REPLACE FUNCTION public.sync_contract_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.status = 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM client_products
      WHERE client_id = NEW.client_id AND product_id = NEW.product_id
    ) THEN
      INSERT INTO client_products (account_id, client_id, product_id)
      VALUES (NEW.account_id, NEW.client_id, NEW.product_id)
      ON CONFLICT (client_id, product_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Produto ativo único: uma tentativa de inserir o mesmo produto nunca desativa o vínculo já existente
CREATE OR REPLACE FUNCTION public.enforce_single_active_client_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active IS TRUE THEN
    UPDATE public.client_products
    SET is_active = false,
        deactivated_at = COALESCE(deactivated_at, now())
    WHERE client_id = NEW.client_id
      AND id <> NEW.id
      AND product_id IS DISTINCT FROM NEW.product_id
      AND is_active IS TRUE;

    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Reativa o produto do contrato ativo mais recente de quem ficou sem produto ativo por causa da falha
--    (desativações manuais gravam horário arredondado em milissegundos e ficam de fora)
WITH pick AS (
  SELECT DISTINCT ON (cc.client_id) cp.id AS cp_id
  FROM public.client_contracts cc
  JOIN public.client_products cp
    ON cp.client_id = cc.client_id AND cp.product_id = cc.product_id
  WHERE cc.status = 'active'
    AND cp.is_active = false
    AND cp.deactivated_at IS DISTINCT FROM date_trunc('milliseconds', cp.deactivated_at)
    AND NOT EXISTS (
      SELECT 1 FROM public.client_products x
      WHERE x.client_id = cc.client_id AND x.is_active
    )
  ORDER BY cc.client_id, cc.start_date DESC NULLS LAST, cc.created_at DESC
)
UPDATE public.client_products cp
SET is_active = true, deactivated_at = NULL
FROM pick
WHERE cp.id = pick.cp_id;