CREATE OR REPLACE FUNCTION public.hr_admissions_set_public_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.public_token IS NULL OR length(NEW.public_token) < 16 THEN
    NEW.public_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;