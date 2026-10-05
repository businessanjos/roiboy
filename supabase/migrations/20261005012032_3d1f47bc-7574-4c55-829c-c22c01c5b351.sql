REVOKE EXECUTE ON FUNCTION public.audit_unified_page(uuid, timestamptz, timestamptz, text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_notification_tab_counts(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_security_audit(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_tasks_page(uuid, text, uuid[], boolean, text, uuid, uuid, uuid, uuid, uuid, uuid, date, date, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.zapp_attendance_daily(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.zapp_attendance_metrics(uuid, timestamptz) FROM PUBLIC, anon;