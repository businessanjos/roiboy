
CREATE OR REPLACE FUNCTION public.hr_admissions_set_public_token()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.public_token IS NULL OR NEW.public_token = '' THEN
    NEW.public_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_admissions_public_token ON public.hr_admissions;
CREATE TRIGGER trg_hr_admissions_public_token
BEFORE INSERT ON public.hr_admissions
FOR EACH ROW EXECUTE FUNCTION public.hr_admissions_set_public_token();

UPDATE public.hr_admissions
SET public_token = encode(gen_random_bytes(24), 'hex')
WHERE public_token IS NULL OR public_token = '';
