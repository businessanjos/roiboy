
DO $$
DECLARE
  v_user_id uuid := 'db8b558b-02e4-4b8a-a161-bd984c10ca7c';
  v_auth_id uuid := 'a20dece3-6561-46de-94bd-1c00fa0a7158';
BEGIN
  DELETE FROM public.user_sector_access WHERE user_id = v_user_id;
  DELETE FROM public.user_team_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_sessions WHERE user_id = v_user_id;
  DELETE FROM public.user_integrations WHERE user_id = v_user_id;
  DELETE FROM public.user_instance_preferences WHERE user_id = v_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = v_auth_id;
  DELETE FROM public.push_notification_preferences WHERE user_id = v_auth_id;
  DELETE FROM public.notifications WHERE user_id = v_user_id;
  DELETE FROM public.super_admins WHERE user_id = v_auth_id;
  DELETE FROM public.users WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_auth_id;
END $$;
