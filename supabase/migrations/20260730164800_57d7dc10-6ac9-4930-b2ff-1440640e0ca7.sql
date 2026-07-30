CREATE OR REPLACE FUNCTION public.set_ec_mentoring_status_updated_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ec_mentoring_status_updated_by ON public.ec_mentoring_client_status;
CREATE TRIGGER trg_set_ec_mentoring_status_updated_by
BEFORE INSERT OR UPDATE ON public.ec_mentoring_client_status
FOR EACH ROW EXECUTE FUNCTION public.set_ec_mentoring_status_updated_by();