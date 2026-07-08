
DROP VIEW IF EXISTS public.active_users CASCADE;
CREATE VIEW public.active_users
WITH (security_invoker = on) AS
SELECT u.*
FROM public.users u
LEFT JOIN public.hr_collaborators c ON c.user_id = u.id
WHERE COALESCE(c.status, 'active') <> 'inactive';

GRANT SELECT ON public.active_users TO authenticated;
GRANT ALL ON public.active_users TO service_role;

CREATE OR REPLACE FUNCTION public.get_default_reassignment_user(_inactive_user_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _dept text;
  _jonathan uuid := '1232ec15-5f66-4b5f-9e74-f40d436f9d0f';
  _andreia  uuid := 'e0017d78-21d4-413a-befc-5197df7ad666';
  _maikol   uuid := 'd20201f6-a9bd-4934-ae50-07ce7a47574b';
BEGIN
  SELECT department INTO _dept FROM public.hr_collaborators WHERE user_id = _inactive_user_id LIMIT 1;
  RETURN CASE
    WHEN _dept = 'Comercial' THEN _jonathan
    WHEN _dept IN ('CS','Customer Success') THEN _andreia
    WHEN _dept IN ('Financeiro','Recursos Humanos','Administrativo','Marketing') THEN _maikol
    ELSE _jonathan
  END;
END; $$;

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

  UPDATE public.internal_tasks SET assigned_to = _to_user WHERE assigned_to = _from_user AND status::text <> 'completed';
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('tasks', _n);

  UPDATE public.client_followups SET user_id = _to_user WHERE user_id = _from_user;
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('followups', _n);

  UPDATE public.zapp_conversation_assignments SET agent_id = _to_user WHERE agent_id = _from_user AND status IN ('active','pending','waiting','triage');
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('zapp_assignments', _n);

  RETURN _counts;
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_user_access(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.user_sessions WHERE user_id = _user_id;
  DELETE FROM public.user_sector_access WHERE user_id = _user_id;
  DELETE FROM public.user_team_roles WHERE user_id = _user_id;
  DELETE FROM public.user_integrations WHERE user_id = _user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = _user_id;
  DELETE FROM public.push_notification_preferences WHERE user_id = _user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.inactivate_collaborator(_collaborator_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_id uuid; _heir uuid; _counts jsonb; _full_name text; _acc uuid;
BEGIN
  SELECT user_id, full_name, account_id INTO _user_id, _full_name, _acc
    FROM public.hr_collaborators WHERE id = _collaborator_id;

  IF _user_id IS NULL THEN
    UPDATE public.hr_collaborators
      SET status = 'inactive', termination_date = COALESCE(termination_date, CURRENT_DATE), updated_at = now()
      WHERE id = _collaborator_id;
    RETURN jsonb_build_object('ok', true, 'note', 'sem_user_vinculado');
  END IF;

  _heir := public.get_default_reassignment_user(_user_id);

  UPDATE public.hr_collaborators
    SET status = 'inactive',
        termination_date = COALESCE(termination_date, CURRENT_DATE),
        notes = COALESCE(notes,'') || CASE WHEN _reason IS NOT NULL THEN E'\n[Inativado] ' || _reason ELSE '' END,
        updated_at = now()
    WHERE id = _collaborator_id;

  _counts := public.reassign_user_records(_user_id, _heir);
  PERFORM public.revoke_user_access(_user_id);

  INSERT INTO public.audit_logs (account_id, user_id, action, entity_type, entity_id, entity_name, details)
  VALUES (_acc, auth.uid(), 'inactivate_collaborator', 'hr_collaborators', _collaborator_id, _full_name,
          jsonb_build_object('inactive_user', _user_id, 'heir_user', _heir, 'reason', _reason, 'reassigned', _counts));

  RETURN jsonb_build_object('ok', true, 'heir', _heir, 'reassigned', _counts);
END; $$;

CREATE OR REPLACE FUNCTION public.auto_heal_inactive_assignments()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rec record; _heir uuid; _counts jsonb; _total jsonb := '{}'::jsonb;
BEGIN
  FOR _rec IN SELECT DISTINCT c.user_id FROM public.hr_collaborators c WHERE c.status='inactive' AND c.user_id IS NOT NULL LOOP
    _heir := public.get_default_reassignment_user(_rec.user_id);
    _counts := public.reassign_user_records(_rec.user_id, _heir);
    PERFORM public.revoke_user_access(_rec.user_id);
    _total := _total || jsonb_build_object(_rec.user_id::text, jsonb_build_object('heir', _heir, 'reassigned', _counts));
  END LOOP;

  INSERT INTO public.audit_logs (account_id, action, entity_type, details)
  VALUES ('796e7970-fd93-4574-a871-6090624cace6', 'auto_heal_inactive', 'hr_collaborators', _total);

  RETURN _total;
END; $$;

SELECT public.auto_heal_inactive_assignments();

REVOKE ALL ON FUNCTION public.inactivate_collaborator(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inactivate_collaborator(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_reassignment_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_user_records(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_heal_inactive_assignments() TO service_role;
