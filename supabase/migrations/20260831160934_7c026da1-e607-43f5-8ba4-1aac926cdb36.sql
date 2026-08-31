
REVOKE ALL ON FUNCTION public.zapp_should_exclude_contact(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.zapp_is_internal_contact(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.zapp_phone_core(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.zapp_should_exclude_contact(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_is_internal_contact(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.zapp_phone_core(text) TO authenticated, service_role;
