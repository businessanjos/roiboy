CREATE OR REPLACE FUNCTION public.tech_projects_set_token_internal(
  _project_id uuid,
  _token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RAISE EXCEPTION 'token too short';
  END IF;

  UPDATE public.tech_projects
  SET
    metrics_token_ciphertext = pgp_sym_encrypt(_token, public.private_get_tech_projects_key()),
    metrics_token_last4 = right(_token, 5),
    metrics_token_rotated_at = now(),
    metrics_token_rotated_by = NULL
  WHERE id = _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_projects_set_token_internal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tech_projects_set_token_internal(uuid, text) TO service_role;