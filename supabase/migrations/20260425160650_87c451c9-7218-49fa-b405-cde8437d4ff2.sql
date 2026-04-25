-- 1) is_active column on users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Drop any pre-existing unique constraint on auth_user_id alone if present.
DO $$
DECLARE
  v_conname text;
BEGIN
  FOR v_conname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'users'
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname::text ORDER BY att.attname::text)
        FROM unnest(con.conkey) AS k(attnum)
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
      )::text[] = ARRAY['auth_user_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_account_uniq
  ON public.users (auth_user_id, account_id)
  WHERE auth_user_id IS NOT NULL;

-- 3) get_my_user_accounts
CREATE OR REPLACE FUNCTION public.get_my_user_accounts()
RETURNS TABLE (
  user_id uuid,
  account_id uuid,
  account_name text,
  role text,
  is_active boolean,
  is_super_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.account_id,
    a.name,
    u.role::text,
    u.is_active,
    EXISTS (SELECT 1 FROM public.super_admins sa WHERE sa.user_id = auth.uid())
  FROM public.users u
  JOIN public.accounts a ON a.id = u.account_id
  WHERE u.auth_user_id = auth.uid()
  ORDER BY a.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_user_accounts() TO authenticated;

-- 4) admin_list_user_memberships
CREATE OR REPLACE FUNCTION public.admin_list_user_memberships(target_auth_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  account_id uuid,
  account_name text,
  role text,
  is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can list user memberships';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.account_id,
    a.name,
    u.role::text,
    u.is_active
  FROM public.users u
  JOIN public.accounts a ON a.id = u.account_id
  WHERE u.auth_user_id = target_auth_user_id
  ORDER BY a.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_user_memberships(uuid) TO authenticated;

-- 5) admin_link_user_to_account
CREATE OR REPLACE FUNCTION public.admin_link_user_to_account(
  target_auth_user_id uuid,
  target_account_id uuid,
  p_role text DEFAULT 'consultor',
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can link users to accounts';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.users
  WHERE auth_user_id = target_auth_user_id
    AND account_id = target_account_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.users
       SET is_active = true
     WHERE id = v_existing_id
       AND is_active = false;
    RETURN v_existing_id;
  END IF;

  SELECT
    COALESCE(p_name, u.name, 'Usuário'),
    COALESCE(p_email, u.email)
  INTO v_name, v_email
  FROM public.users u
  WHERE u.auth_user_id = target_auth_user_id
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF v_email IS NULL THEN
    SELECT au.email INTO v_email FROM auth.users au WHERE au.id = target_auth_user_id;
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Cannot determine email for user %', target_auth_user_id;
  END IF;

  INSERT INTO public.users (
    auth_user_id,
    account_id,
    name,
    email,
    role,
    is_active
  ) VALUES (
    target_auth_user_id,
    target_account_id,
    v_name,
    v_email,
    p_role::public.user_role,
    true
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_link_user_to_account(uuid, uuid, text, text, text) TO authenticated;