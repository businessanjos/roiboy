REVOKE EXECUTE ON FUNCTION public.can_view_deal(text,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_deal_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_deal(text,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_deal_id(uuid) TO authenticated;