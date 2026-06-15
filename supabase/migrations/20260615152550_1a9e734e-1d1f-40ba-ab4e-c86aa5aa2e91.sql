CREATE OR REPLACE FUNCTION public.tech_projects_get_token_internal(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key text;
  _cipher bytea;
  _plain text;
BEGIN
  SELECT master_key INTO _key FROM public.private_tech_projects_key WHERE id = 1;
  IF _key IS NULL THEN RETURN NULL; END IF;

  SELECT metrics_token_ciphertext INTO _cipher FROM public.tech_projects WHERE id = _project_id;
  IF _cipher IS NULL THEN RETURN NULL; END IF;

  BEGIN
    _plain := pgp_sym_decrypt(_cipher, _key);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN _plain;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_projects_get_token_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tech_projects_get_token_internal(uuid) TO service_role;