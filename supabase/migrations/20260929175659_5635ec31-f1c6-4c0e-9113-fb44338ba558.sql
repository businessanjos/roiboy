CREATE TABLE public.permission_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);
CREATE TABLE public.permission_profile_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  module text NOT NULL,
  sub_item text NOT NULL,
  access_level text NOT NULL DEFAULT 'none' CHECK (access_level IN ('none','view','manage')),
  scope text NOT NULL DEFAULT 'own' CHECK (scope IN ('own','all')),
  UNIQUE (profile_id, module, sub_item)
);
CREATE TABLE public.user_permission_profiles (
  user_id uuid PRIMARY KEY,
  account_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  module text NOT NULL,
  sub_item text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('none','view','manage')),
  scope text NOT NULL DEFAULT 'own' CHECK (scope IN ('own','all')),
  UNIQUE (user_id, module, sub_item)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_profiles, public.permission_profile_items, public.user_permission_profiles, public.user_permission_overrides TO authenticated;
GRANT ALL ON public.permission_profiles, public.permission_profile_items, public.user_permission_profiles, public.user_permission_overrides TO service_role;

ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_profile_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read account" ON public.permission_profiles FOR SELECT TO authenticated USING (account_id = get_user_account_id());
CREATE POLICY "managers write" ON public.permission_profiles FOR ALL TO authenticated
  USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));

CREATE POLICY "read account" ON public.permission_profile_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM permission_profiles p WHERE p.id = profile_id AND p.account_id = get_user_account_id()));
CREATE POLICY "managers write" ON public.permission_profile_items FOR ALL TO authenticated
  USING (can_manage_spiff_payments(auth.uid()) AND EXISTS (SELECT 1 FROM permission_profiles p WHERE p.id = profile_id AND p.account_id = get_user_account_id()))
  WITH CHECK (can_manage_spiff_payments(auth.uid()) AND EXISTS (SELECT 1 FROM permission_profiles p WHERE p.id = profile_id AND p.account_id = get_user_account_id()));

CREATE POLICY "read own or manager" ON public.user_permission_profiles FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND (user_id = get_current_user_id() OR can_manage_spiff_payments(auth.uid())));
CREATE POLICY "managers write" ON public.user_permission_profiles FOR ALL TO authenticated
  USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));

CREATE POLICY "read own or manager" ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (account_id = get_user_account_id() AND (user_id = get_current_user_id() OR can_manage_spiff_payments(auth.uid())));
CREATE POLICY "managers write" ON public.user_permission_overrides FOR ALL TO authenticated
  USING (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()))
  WITH CHECK (account_id = get_user_account_id() AND can_manage_spiff_payments(auth.uid()));

CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON public.permission_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permissão efetiva: override > perfil
CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := get_current_user_id(); _res jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('is_admin', false, 'permissions', '[]'::jsonb); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('module', module, 'sub_item', sub_item, 'access_level', access_level, 'scope', scope)), '[]'::jsonb)
  INTO _res FROM (
    SELECT o.module, o.sub_item, o.access_level, o.scope FROM user_permission_overrides o WHERE o.user_id = _uid
    UNION ALL
    SELECT i.module, i.sub_item, i.access_level, i.scope
      FROM user_permission_profiles up JOIN permission_profile_items i ON i.profile_id = up.profile_id
     WHERE up.user_id = _uid
       AND NOT EXISTS (SELECT 1 FROM user_permission_overrides o WHERE o.user_id = _uid AND o.module = i.module AND o.sub_item = i.sub_item)
  ) x;
  RETURN jsonb_build_object('is_admin', can_manage_spiff_payments(auth.uid()), 'permissions', _res);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_user_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_permissions() TO authenticated;

-- Negócios: perfil/override com alcance "all" também libera
CREATE OR REPLACE FUNCTION public.can_view_deal(
  _status text, _responsible uuid, _sdr uuid, _renewal uuid, _created_by uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := get_current_user_id();
  _sub text := CASE WHEN _status = 'won' THEN 'deals_won' WHEN _status = 'lost' THEN 'deals_lost' ELSE 'deals_open' END;
  _v record; _lvl text; _scope text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF can_manage_spiff_payments(auth.uid()) THEN RETURN true; END IF;
  IF _uid IS NOT NULL AND _uid IN (_responsible, _sdr, _renewal, _created_by) THEN RETURN true; END IF;

  SELECT access_level, scope INTO _lvl, _scope FROM user_permission_overrides
   WHERE user_id = _uid AND module = 'comercial' AND sub_item = _sub;
  IF NOT FOUND THEN
    SELECT i.access_level, i.scope INTO _lvl, _scope
      FROM user_permission_profiles up JOIN permission_profile_items i ON i.profile_id = up.profile_id
     WHERE up.user_id = _uid AND i.module = 'comercial' AND i.sub_item = _sub;
  END IF;
  IF _lvl IS NOT NULL AND _lvl <> 'none' AND _scope = 'all' THEN RETURN true; END IF;

  SELECT can_view_open, can_view_won, can_view_lost INTO _v
    FROM user_deal_visibility WHERE user_id = _uid LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;
  IF _status = 'won' THEN RETURN _v.can_view_won; END IF;
  IF _status = 'lost' THEN RETURN _v.can_view_lost; END IF;
  RETURN _v.can_view_open;
END $$;