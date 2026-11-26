CREATE OR REPLACE FUNCTION public.set_zapp_agent_active(_agent_id uuid, _active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent public.zapp_agents%ROWTYPE;
  v_user_active boolean;
  v_released integer := 0;
BEGIN
  SELECT * INTO v_agent
    FROM public.zapp_agents a
   WHERE a.id = _agent_id
     AND a.account_id = public.get_user_account_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendente não encontrado';
  END IF;

  IF NOT (
    public.is_account_owner()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.role = 'gestor')
  ) THEN
    RAISE EXCEPTION 'Somente administradores ou gestores podem inativar ou reativar atendentes' USING ERRCODE = '42501';
  END IF;

  IF coalesce(_active, false) THEN
    SELECT coalesce(u.is_active, true) INTO v_user_active FROM public.users u WHERE u.id = v_agent.user_id;
    IF v_user_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Esta pessoa está desativada na equipe. Reative o cadastro dela antes.';
    END IF;
    UPDATE public.zapp_agents a SET is_active = true, updated_at = now() WHERE a.id = _agent_id;
  ELSE
    SELECT count(*) INTO v_released
      FROM public.zapp_conversation_assignments za
     WHERE za.agent_id = _agent_id AND za.status <> 'closed';
    -- Mesmo caminho usado quando a pessoa é desativada na equipe.
    PERFORM public.release_zapp_assignments_for_user(v_agent.user_id);
    UPDATE public.zapp_agents a SET is_active = false, is_online = false, updated_at = now() WHERE a.id = _agent_id;
  END IF;

  RETURN jsonb_build_object('active', coalesce(_active, false), 'released', v_released);
END;
$$;

REVOKE ALL ON FUNCTION public.set_zapp_agent_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_zapp_agent_active(uuid, boolean) TO authenticated, service_role;