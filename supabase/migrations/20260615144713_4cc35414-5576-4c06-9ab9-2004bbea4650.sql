
-- Extensão de criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela privada com a chave mestre (sem grants — só SECURITY DEFINER acessa)
CREATE TABLE IF NOT EXISTS private_tech_projects_key (
  id int PRIMARY KEY DEFAULT 1,
  master_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
REVOKE ALL ON private_tech_projects_key FROM PUBLIC, anon, authenticated;

-- Insere a chave aleatória uma única vez
INSERT INTO private_tech_projects_key (id, master_key)
VALUES (1, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- Colunas novas em tech_projects
ALTER TABLE public.tech_projects
  ADD COLUMN IF NOT EXISTS metrics_token_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS metrics_token_last4 text,
  ADD COLUMN IF NOT EXISTS metrics_token_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS metrics_token_rotated_by uuid;

-- Helper interno: pega a chave
CREATE OR REPLACE FUNCTION private_get_tech_projects_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT master_key FROM private_tech_projects_key WHERE id = 1
$$;
REVOKE ALL ON FUNCTION private_get_tech_projects_key() FROM PUBLIC, anon, authenticated;

-- Helper: valida que o usuário é admin da conta dona do projeto
CREATE OR REPLACE FUNCTION public._tech_project_owner_check(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tech_projects tp
    JOIN users u ON u.account_id = tp.account_id
    WHERE tp.id = _project_id
      AND u.auth_user_id = auth.uid()
      AND public.is_account_owner()
  )
$$;

-- Define / rotaciona o token de um projeto
CREATE OR REPLACE FUNCTION public.tech_projects_set_token(
  _project_id uuid,
  _token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT id INTO v_uid FROM users WHERE auth_user_id = auth.uid() LIMIT 1;

  UPDATE tech_projects
  SET
    metrics_token_ciphertext = pgp_sym_encrypt(_token, private_get_tech_projects_key()),
    metrics_token_last4 = right(_token, 4),
    metrics_token_rotated_at = now(),
    metrics_token_rotated_by = v_uid
  WHERE id = _project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tech_projects_set_token(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_projects_set_token(uuid, text) TO authenticated;

-- Revela o token (autenticado + owner)
CREATE OR REPLACE FUNCTION public.tech_projects_reveal_token(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cipher bytea;
BEGIN
  IF NOT public._tech_project_owner_check(_project_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT metrics_token_ciphertext INTO v_cipher FROM tech_projects WHERE id = _project_id;
  IF v_cipher IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(v_cipher, private_get_tech_projects_key());
END;
$$;
REVOKE ALL ON FUNCTION public.tech_projects_reveal_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_projects_reveal_token(uuid) TO authenticated;

-- Limpa o token
CREATE OR REPLACE FUNCTION public.tech_projects_clear_token(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._tech_project_owner_check(_project_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE tech_projects
  SET metrics_token_ciphertext = NULL,
      metrics_token_last4 = NULL,
      metrics_token_rotated_at = NULL,
      metrics_token_rotated_by = NULL
  WHERE id = _project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.tech_projects_clear_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tech_projects_clear_token(uuid) TO authenticated;
