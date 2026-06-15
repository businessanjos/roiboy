CREATE OR REPLACE FUNCTION public.tech_projects_set_token(
  _project_id uuid,
  _token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF NOT public._tech_project_owner_check(_project_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _token IS NULL OR length(_token) < 8 THEN
    RAISE EXCEPTION 'token too short';
  END IF;

  SELECT id INTO v_uid FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  UPDATE public.tech_projects
  SET
    metrics_token_ciphertext = extensions.pgp_sym_encrypt(_token, public.private_get_tech_projects_key()),
    metrics_token_last4 = right(_token, 5),
    metrics_token_rotated_at = now(),
    metrics_token_rotated_by = v_uid
  WHERE id = _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_projects_set_token(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_projects_set_token(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tech_projects_reveal_token(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cipher bytea;
BEGIN
  IF NOT public._tech_project_owner_check(_project_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT metrics_token_ciphertext INTO v_cipher FROM public.tech_projects WHERE id = _project_id;
  IF v_cipher IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN extensions.pgp_sym_decrypt(v_cipher, public.private_get_tech_projects_key());
END;
$$;

REVOKE ALL ON FUNCTION public.tech_projects_reveal_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_projects_reveal_token(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.tech_projects_get_token_internal(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _cipher bytea;
  _plain text;
BEGIN
  SELECT metrics_token_ciphertext INTO _cipher FROM public.tech_projects WHERE id = _project_id;
  IF _cipher IS NULL THEN RETURN NULL; END IF;

  BEGIN
    _plain := extensions.pgp_sym_decrypt(_cipher, public.private_get_tech_projects_key());
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN _plain;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_projects_get_token_internal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tech_projects_get_token_internal(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tech_projects_set_token_internal(
  _project_id uuid,
  _token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RAISE EXCEPTION 'token too short';
  END IF;

  UPDATE public.tech_projects
  SET
    metrics_token_ciphertext = extensions.pgp_sym_encrypt(_token, public.private_get_tech_projects_key()),
    metrics_token_last4 = right(_token, 5),
    metrics_token_rotated_at = now(),
    metrics_token_rotated_by = NULL
  WHERE id = _project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tech_projects_set_token_internal(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tech_projects_set_token_internal(uuid, text) TO service_role;