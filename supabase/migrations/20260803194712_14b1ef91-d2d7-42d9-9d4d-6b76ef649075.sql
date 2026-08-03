ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS recent_activity_at timestamptz;

UPDATE public.clients c
SET recent_activity_at = GREATEST(
  c.created_at,
  COALESCE((SELECT MAX(GREATEST(cc.created_at, COALESCE(cc.start_date::timestamptz, cc.created_at)))
            FROM public.client_contracts cc
            WHERE cc.client_id = c.id), c.created_at)
);

ALTER TABLE public.clients ALTER COLUMN recent_activity_at SET DEFAULT now();

UPDATE public.clients SET recent_activity_at = created_at WHERE recent_activity_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_recent_activity_at ON public.clients (account_id, recent_activity_at DESC);

CREATE OR REPLACE FUNCTION public.touch_client_recent_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients c
  SET recent_activity_at = GREATEST(
    COALESCE(c.recent_activity_at, c.created_at),
    NEW.created_at,
    COALESCE(NEW.start_date::timestamptz, NEW.created_at)
  )
  WHERE c.id = NEW.client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_client_recent_activity ON public.client_contracts;
CREATE TRIGGER trg_touch_client_recent_activity
AFTER INSERT OR UPDATE OF start_date, status ON public.client_contracts
FOR EACH ROW EXECUTE FUNCTION public.touch_client_recent_activity();