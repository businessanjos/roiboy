
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS education_specialty TEXT;

CREATE OR REPLACE FUNCTION public.sync_deal_education_to_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND (
       NEW.education IS DISTINCT FROM COALESCE(OLD.education, NULL)
    OR NEW.education_specialty IS DISTINCT FROM COALESCE(OLD.education_specialty, NULL)
    OR NEW.client_id IS DISTINCT FROM COALESCE(OLD.client_id, NULL)
  ) THEN
    UPDATE public.clients c
       SET education = COALESCE(NEW.education, c.education),
           education_specialty = COALESCE(NEW.education_specialty, c.education_specialty)
     WHERE c.id = NEW.client_id
       AND c.account_id = NEW.account_id
       AND (
            (NEW.education IS NOT NULL AND NEW.education IS DISTINCT FROM c.education)
         OR (NEW.education_specialty IS NOT NULL AND NEW.education_specialty IS DISTINCT FROM c.education_specialty)
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deal_education_to_client ON public.deals;
CREATE TRIGGER trg_sync_deal_education_to_client
AFTER INSERT OR UPDATE OF education, education_specialty, client_id ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_education_to_client();
