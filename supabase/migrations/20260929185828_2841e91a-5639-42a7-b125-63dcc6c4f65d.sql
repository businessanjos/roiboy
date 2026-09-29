CREATE TABLE public.user_pipeline_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  access text NOT NULL CHECK (access IN ('none','own','all')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pipeline_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_pipeline_access TO authenticated;
GRANT ALL ON public.user_pipeline_access TO service_role;
ALTER TABLE public.user_pipeline_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY upa_select ON public.user_pipeline_access FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND (user_id = get_current_user_id() OR can_manage_spiff_payments(auth.uid())));
CREATE POLICY upa_insert ON public.user_pipeline_access FOR INSERT TO authenticated
  WITH CHECK (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));
CREATE POLICY upa_update ON public.user_pipeline_access FOR UPDATE TO authenticated
  USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));
CREATE POLICY upa_delete ON public.user_pipeline_access FOR DELETE TO authenticated
  USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_view_deal(_status text, _responsible uuid, _sdr uuid, _renewal uuid, _created_by uuid, _pipeline uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := get_current_user_id();
  _sub text := CASE WHEN _status = 'won' THEN 'deals_won' WHEN _status = 'lost' THEN 'deals_lost' ELSE 'deals_open' END;
  _v record; _lvl text; _scope text; _pacc text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF can_manage_spiff_payments(auth.uid()) THEN RETURN true; END IF;
  IF _pipeline IS NOT NULL THEN
    SELECT access INTO _pacc FROM user_pipeline_access WHERE user_id = _uid AND pipeline_id = _pipeline;
    IF _pacc = 'none' THEN RETURN false; END IF;
  END IF;
  IF _uid IS NOT NULL AND _uid IN (_responsible, _sdr, _renewal, _created_by) THEN RETURN true; END IF;
  IF _pacc = 'all' THEN RETURN true; END IF;

  SELECT access_level, scope INTO _lvl, _scope FROM user_permission_overrides
   WHERE user_id = _uid AND module = 'comercial' AND sub_item = _sub;
  IF NOT FOUND THEN
    SELECT i.access_level, i.scope INTO _lvl, _scope
      FROM user_permission_profiles up JOIN permission_profile_items i ON i.profile_id = up.profile_id
     WHERE up.user_id = _uid AND i.module = 'comercial' AND i.sub_item = _sub;
  END IF;
  IF _lvl IS NOT NULL AND _lvl <> 'none' AND _scope = 'all' THEN RETURN true; END IF;

  SELECT can_view_open, can_view_won, can_view_lost INTO _v FROM user_deal_visibility WHERE user_id = _uid LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF _status = 'won' THEN RETURN _v.can_view_won; END IF;
  IF _status = 'lost' THEN RETURN _v.can_view_lost; END IF;
  RETURN _v.can_view_open;
END $function$;
REVOKE ALL ON FUNCTION public.can_view_deal(text,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_deal(text,uuid,uuid,uuid,uuid,uuid) TO authenticated;

DROP POLICY deal_visibility_select ON public.deals;
DROP POLICY deal_visibility_update ON public.deals;
DROP POLICY deal_visibility_delete ON public.deals;
CREATE POLICY deal_visibility_select ON public.deals AS RESTRICTIVE FOR SELECT TO authenticated
  USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by, pipeline_id));
CREATE POLICY deal_visibility_update ON public.deals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by, pipeline_id));
CREATE POLICY deal_visibility_delete ON public.deals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (can_view_deal(status::text, responsible_user_id, sdr_user_id, renewal_responsible_user_id, created_by, pipeline_id));

CREATE OR REPLACE FUNCTION public.can_view_deal_id(_deal_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT can_view_deal(d.status::text, d.responsible_user_id, d.sdr_user_id, d.renewal_responsible_user_id, d.created_by, d.pipeline_id)
    FROM deals d WHERE d.id = _deal_id), true)
$function$;

DROP FUNCTION public.can_view_deal(text,uuid,uuid,uuid,uuid);