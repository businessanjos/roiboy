CREATE OR REPLACE FUNCTION public.log_user_access_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record := coalesce(NEW, OLD);
  actor record;
  target_name text;
  act text;
  det jsonb;
BEGIN
  IF current_setting('app.replicating_access', true) = 'on' THEN RETURN NULL; END IF;
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT id, name, email INTO actor FROM users WHERE auth_user_id = auth.uid() AND account_id = r.account_id LIMIT 1;
  SELECT name INTO target_name FROM users WHERE id = r.user_id;
  IF TG_TABLE_NAME = 'user_permission_overrides' THEN
    act := 'user.permission_changed';
    det := jsonb_build_object('item', r.module || '/' || r.sub_item,
      'antes', CASE WHEN TG_OP='INSERT' THEN 'Padrão' ELSE OLD.access_level || '/' || OLD.scope END,
      'depois', CASE WHEN TG_OP='DELETE' THEN 'Padrão' ELSE NEW.access_level || '/' || NEW.scope END);
  ELSIF TG_TABLE_NAME = 'user_pipeline_access' THEN
    act := 'user.pipeline_access_changed';
    det := jsonb_build_object('funil', (SELECT name FROM pipelines WHERE id = r.pipeline_id),
      'antes', CASE WHEN TG_OP='INSERT' THEN 'own' ELSE OLD.access END,
      'depois', CASE WHEN TG_OP='DELETE' THEN 'own' ELSE NEW.access END);
  ELSE
    act := 'user.deal_visibility_changed';
    det := jsonb_build_object('op', TG_OP, 'depois', CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) - 'id' - 'account_id' - 'user_id' - 'created_at' - 'updated_at' END);
  END IF;
  INSERT INTO audit_logs (account_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, details)
  VALUES (r.account_id, actor.id, actor.name, actor.email, act, 'user', r.user_id, target_name, det);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.log_user_access_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_upo ON public.user_permission_overrides;
CREATE TRIGGER trg_audit_upo AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides FOR EACH ROW EXECUTE FUNCTION public.log_user_access_change();
DROP TRIGGER IF EXISTS trg_audit_upa ON public.user_pipeline_access;
CREATE TRIGGER trg_audit_upa AFTER INSERT OR UPDATE OR DELETE ON public.user_pipeline_access FOR EACH ROW EXECUTE FUNCTION public.log_user_access_change();
DROP TRIGGER IF EXISTS trg_audit_udv ON public.user_deal_visibility;
CREATE TRIGGER trg_audit_udv AFTER INSERT OR UPDATE OR DELETE ON public.user_deal_visibility FOR EACH ROW EXECUTE FUNCTION public.log_user_access_change();

CREATE OR REPLACE FUNCTION public.replicate_user_access(_source uuid, _targets uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _acc uuid := get_user_account_id();
  _n int;
  actor record;
  src_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT can_manage_spiff_payments(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para replicar acessos';
  END IF;
  SELECT name INTO src_name FROM users WHERE id = _source AND account_id = _acc;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pessoa de origem inválida'; END IF;
  _targets := ARRAY(SELECT DISTINCT t FROM unnest(_targets) t WHERE t <> _source);
  SELECT count(*) INTO _n FROM users WHERE id = ANY(_targets) AND account_id = _acc;
  IF _n <> coalesce(array_length(_targets,1),0) THEN RAISE EXCEPTION 'Pessoa de destino fora da empresa'; END IF;
  IF _n = 0 THEN RETURN 0; END IF;

  PERFORM set_config('app.replicating_access', 'on', true);

  DELETE FROM user_permission_overrides WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_permission_overrides (user_id, account_id, module, sub_item, access_level, scope)
    SELECT t, _acc, o.module, o.sub_item, o.access_level, o.scope
    FROM user_permission_overrides o CROSS JOIN unnest(_targets) t WHERE o.user_id = _source AND o.account_id = _acc;

  DELETE FROM user_pipeline_access WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_pipeline_access (user_id, account_id, pipeline_id, access)
    SELECT t, _acc, p.pipeline_id, p.access
    FROM user_pipeline_access p CROSS JOIN unnest(_targets) t WHERE p.user_id = _source AND p.account_id = _acc;

  DELETE FROM user_sector_access WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_sector_access (user_id, account_id, sector_id, role_in_sector, is_active)
    SELECT t, _acc, s.sector_id, s.role_in_sector, s.is_active
    FROM user_sector_access s CROSS JOIN unnest(_targets) t WHERE s.user_id = _source AND s.account_id = _acc;

  DELETE FROM user_team_roles WHERE user_id = ANY(_targets);
  INSERT INTO user_team_roles (user_id, team_role_id)
    SELECT t, r.team_role_id FROM user_team_roles r CROSS JOIN unnest(_targets) t WHERE r.user_id = _source;

  DELETE FROM user_deal_visibility WHERE user_id = ANY(_targets) AND account_id = _acc;
  INSERT INTO user_deal_visibility (user_id, account_id, can_view_open, can_view_won, can_view_lost)
    SELECT t, _acc, v.can_view_open, v.can_view_won, v.can_view_lost
    FROM user_deal_visibility v CROSS JOIN unnest(_targets) t WHERE v.user_id = _source AND v.account_id = _acc;

  PERFORM set_config('app.replicating_access', 'off', true);

  SELECT id, name, email INTO actor FROM users WHERE auth_user_id = auth.uid() AND account_id = _acc LIMIT 1;
  INSERT INTO audit_logs (account_id, user_id, user_name, user_email, action, entity_type, entity_id, entity_name, details)
    SELECT _acc, actor.id, actor.name, actor.email, 'user.access_replicated', 'user', u.id, u.name,
           jsonb_build_object('origem_id', _source, 'origem', src_name)
    FROM users u WHERE u.id = ANY(_targets);
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.replicate_user_access(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replicate_user_access(uuid, uuid[]) TO authenticated;