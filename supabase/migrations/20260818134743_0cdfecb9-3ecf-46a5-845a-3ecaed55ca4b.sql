-- 1) Restore task ownership for Vanessa: task owner is independent from lead/deal owner
UPDATE public.internal_tasks t
SET assigned_to = t.created_by
WHERE t.created_by IN (SELECT id FROM public.users WHERE name ILIKE '%vanessa%')
  AND t.assigned_to = '1232ec15-5f66-4b5f-9e74-f40d436f9d0f';

-- 2) Stop reassigning tasks when a user is offboarded / records transferred
CREATE OR REPLACE FUNCTION public.reassign_user_records(_from_user uuid, _to_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _counts jsonb := '{}'::jsonb; _n int;
BEGIN
  IF _from_user IS NULL OR _to_user IS NULL OR _from_user = _to_user THEN RETURN _counts; END IF;

  UPDATE public.leads SET responsible_user_id = _to_user WHERE responsible_user_id = _from_user;
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('leads', _n);

  UPDATE public.deals SET responsible_user_id = _to_user WHERE responsible_user_id = _from_user AND status::text NOT IN ('won','lost');
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('deals_responsible', _n);

  UPDATE public.deals SET sdr_user_id = _to_user WHERE sdr_user_id = _from_user AND status::text NOT IN ('won','lost');
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('deals_sdr', _n);

  UPDATE public.clients SET responsible_user_id = _to_user WHERE responsible_user_id = _from_user;
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('clients', _n);

  -- Histórico de atividades (internal_tasks) NÃO é transferido: o dono da tarefa
  -- é independente do dono atual do lead/negócio.
  _counts := _counts || jsonb_build_object('tasks', 0);

  UPDATE public.client_followups SET user_id = _to_user WHERE user_id = _from_user;
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('followups', _n);

  UPDATE public.zapp_conversation_assignments SET agent_id = _to_user WHERE agent_id = _from_user AND status IN ('active','pending','waiting','triage');
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('zapp_assignments', _n);

  RETURN _counts;
END; $$;