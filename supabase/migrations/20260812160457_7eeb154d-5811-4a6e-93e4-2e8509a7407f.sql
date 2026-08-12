-- 1) Preenche client_id no briefing a partir do deal quando salvo sem cliente
CREATE OR REPLACE FUNCTION public.sync_briefing_client_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.deal_id IS NOT NULL THEN
    SELECT d.client_id INTO NEW.client_id FROM public.deals d WHERE d.id = NEW.deal_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_briefing_client_id ON public.deal_operation_briefings;
CREATE TRIGGER tg_sync_briefing_client_id
BEFORE INSERT OR UPDATE ON public.deal_operation_briefings
FOR EACH ROW EXECUTE FUNCTION public.sync_briefing_client_id();

-- 2) Ao converter o negócio em cliente, propaga o cliente para o briefing
CREATE OR REPLACE FUNCTION public.propagate_deal_client_to_briefing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    UPDATE public.deal_operation_briefings
       SET client_id = NEW.client_id
     WHERE deal_id = NEW.id
       AND client_id IS DISTINCT FROM NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_propagate_deal_client_to_briefing ON public.deals;
CREATE TRIGGER tg_propagate_deal_client_to_briefing
AFTER UPDATE OF client_id ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.propagate_deal_client_to_briefing();

-- 3) Backfill dos briefings existentes
UPDATE public.deal_operation_briefings b
   SET client_id = d.client_id
  FROM public.deals d
 WHERE b.deal_id = d.id
   AND b.client_id IS NULL
   AND d.client_id IS NOT NULL;