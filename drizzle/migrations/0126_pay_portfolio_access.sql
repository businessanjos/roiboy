CREATE OR REPLACE FUNCTION public.can_view_pay_portfolio()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(public.can_manage_spiff_payments(auth.uid()), false)
    OR COALESCE((
      SELECT x.lvl IN ('view','manage') FROM (
        SELECT o.access_level::text AS lvl, 0 AS ord
          FROM public.user_permission_overrides o
         WHERE o.user_id = public.get_current_user_id()
           AND o.module = 'comercial' AND o.sub_item = 'subscriptions'
        UNION ALL
        SELECT i.access_level::text,
               CASE i.access_level::text WHEN 'manage' THEN 1 WHEN 'view' THEN 2 ELSE 3 END
          FROM public.user_permission_profiles up
          JOIN public.permission_profile_items i ON i.profile_id = up.profile_id
         WHERE up.user_id = public.get_current_user_id()
           AND i.module = 'comercial' AND i.sub_item = 'subscriptions'
      ) x ORDER BY x.ord LIMIT 1
    ), false);
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_pay_portfolio() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_view_pay_portfolio() TO authenticated, service_role;