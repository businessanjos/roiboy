CREATE OR REPLACE FUNCTION public.touch_client_recent_activity_from_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
     SET recent_activity_at = GREATEST(COALESCE(recent_activity_at, NEW.happened_at), NEW.happened_at)
   WHERE id = NEW.client_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_client_recent_activity_from_checkin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_checkin_touch_client_activity ON public.client_checkins;
CREATE TRIGGER trg_checkin_touch_client_activity
AFTER INSERT OR UPDATE OF happened_at ON public.client_checkins
FOR EACH ROW EXECUTE FUNCTION public.touch_client_recent_activity_from_checkin();

UPDATE public.clients c
   SET recent_activity_at = k.last_at
  FROM (SELECT client_id, MAX(happened_at) AS last_at FROM public.client_checkins GROUP BY client_id) k
 WHERE c.id = k.client_id
   AND (c.recent_activity_at IS NULL OR c.recent_activity_at < k.last_at);