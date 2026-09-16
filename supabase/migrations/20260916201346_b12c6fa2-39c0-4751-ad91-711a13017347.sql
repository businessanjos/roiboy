ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE OR REPLACE FUNCTION public.set_deal_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := public.get_current_user_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_deal_created_by ON public.deals;
CREATE TRIGGER trg_set_deal_created_by
BEFORE INSERT ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.set_deal_created_by();