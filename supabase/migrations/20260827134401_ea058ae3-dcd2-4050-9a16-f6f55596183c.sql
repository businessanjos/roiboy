
REVOKE EXECUTE ON FUNCTION public.claim_zapp_ruler_touches(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_zapp_ruler_touches(integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_zapp_ruler_enrollment() FROM PUBLIC, anon, authenticated;
