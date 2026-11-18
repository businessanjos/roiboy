DO $$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.delete_account_cascade(uuid)'::regprocedure);
  v_def := replace(v_def,
    'IF NOT public.is_super_admin(auth.uid()) THEN',
    'IF COALESCE(auth.role(), '''') <> ''service_role'' AND NOT public.is_super_admin(auth.uid()) THEN');
  EXECUTE v_def;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_account_cascade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_cascade(uuid) TO service_role;