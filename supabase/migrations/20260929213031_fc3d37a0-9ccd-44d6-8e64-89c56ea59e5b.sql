CREATE OR REPLACE FUNCTION public.replicate_user_access(_source uuid, _targets uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _acc uuid := get_user_account_id();
  _n int;
BEGIN
  IF auth.uid() IS NULL OR NOT can_manage_spiff_payments(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para replicar acessos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = _source AND account_id = _acc) THEN
    RAISE EXCEPTION 'Pessoa de origem inválida';
  END IF;
  _targets := ARRAY(SELECT DISTINCT t FROM unnest(_targets) t WHERE t <> _source);
  SELECT count(*) INTO _n FROM users WHERE id = ANY(_targets) AND account_id = _acc;
  IF _n <> coalesce(array_length(_targets,1),0) THEN
    RAISE EXCEPTION 'Pessoa de destino fora da empresa';
  END IF;
  IF _n = 0 THEN RETURN 0; END IF;

  DELETE FROM user_permission_overrides WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_permission_overrides (user_id, account_id, module, sub_item, access_level, scope)
    SELECT t, _acc, o.module, o.sub_item, o.access_level, o.scope
    FROM user_permission_overrides o CROSS JOIN unnest(_targets) t
    WHERE o.user_id = _source AND o.account_id = _acc;

  DELETE FROM user_pipeline_access WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_pipeline_access (user_id, account_id, pipeline_id, access)
    SELECT t, _acc, p.pipeline_id, p.access
    FROM user_pipeline_access p CROSS JOIN unnest(_targets) t
    WHERE p.user_id = _source AND p.account_id = _acc;

  DELETE FROM user_sector_access WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_sector_access (user_id, account_id, sector_id, role_in_sector, is_active)
    SELECT t, _acc, s.sector_id, s.role_in_sector, s.is_active
    FROM user_sector_access s CROSS JOIN unnest(_targets) t
    WHERE s.user_id = _source AND s.account_id = _acc;

  DELETE FROM user_team_roles WHERE user_id = ANY(_targets);
  INSERT INTO user_team_roles (user_id, team_role_id)
    SELECT t, r.team_role_id FROM user_team_roles r CROSS JOIN unnest(_targets) t
    WHERE r.user_id = _source;

  DELETE FROM user_deal_visibility WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_deal_visibility (user_id, account_id, can_view_open, can_view_won, can_view_lost)
    SELECT t, _acc, v.can_view_open, v.can_view_won, v.can_view_lost
    FROM user_deal_visibility v CROSS JOIN unnest(_targets) t
    WHERE v.user_id = _source AND v.account_id = _acc;

  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.replicate_user_access(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replicate_user_access(uuid, uuid[]) TO authenticated;