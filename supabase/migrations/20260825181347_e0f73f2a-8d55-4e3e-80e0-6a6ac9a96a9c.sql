-- 1) Normaliza dados existentes: mantém apenas o vínculo ativo mais recente por cliente
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.client_products
  WHERE is_active IS TRUE
)
UPDATE public.client_products cp
SET is_active = false,
    deactivated_at = COALESCE(cp.deactivated_at, now())
FROM ranked r
WHERE cp.id = r.id AND r.rn > 1;

-- 2) Trigger: ao ativar um produto, desativa os demais do mesmo cliente
CREATE OR REPLACE FUNCTION public.enforce_single_active_client_product()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS TRUE THEN
    UPDATE public.client_products
    SET is_active = false,
        deactivated_at = COALESCE(deactivated_at, now())
    WHERE client_id = NEW.client_id
      AND id <> NEW.id
      AND is_active IS TRUE;

    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_active_client_product ON public.client_products;
CREATE TRIGGER trg_enforce_single_active_client_product
BEFORE INSERT OR UPDATE OF is_active, client_id ON public.client_products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_active_client_product();

-- 3) Trava final: no máximo um produto ativo por cliente
CREATE UNIQUE INDEX IF NOT EXISTS client_products_one_active_per_client
ON public.client_products (client_id)
WHERE is_active IS TRUE;