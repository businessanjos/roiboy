CREATE OR REPLACE FUNCTION public.admin_link_user_to_account(
  target_auth_user_id uuid,
  target_account_id uuid,
  p_role text DEFAULT 'member'::text,
  p_name text DEFAULT NULL::text,
  p_email text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
  v_name text;
  v_email text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can link users to accounts';
  END IF;

  IF p_role NOT IN ('admin', 'super_admin', 'gestor', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Perfil de acesso inválido: "%". Valores aceitos: admin, gestor, member, viewer.', p_role
      USING ERRCODE = '22023';
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
$function$;