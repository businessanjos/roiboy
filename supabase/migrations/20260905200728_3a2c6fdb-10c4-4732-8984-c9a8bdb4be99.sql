
CREATE TABLE IF NOT EXISTS public.traffic_hub_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE,
  endpoint_url text,
  auth_token text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_hub_settings TO authenticated;
GRANT ALL ON public.traffic_hub_settings TO service_role;
ALTER TABLE public.traffic_hub_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traffic_hub_settings_admin_all" ON public.traffic_hub_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.account_id = traffic_hub_settings.account_id AND (u.role = 'admin'::user_role OR u.is_also_admin = true)))
WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.account_id = traffic_hub_settings.account_id AND (u.role = 'admin'::user_role OR u.is_also_admin = true)));

CREATE TABLE IF NOT EXISTS public.traffic_hub_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_status_code integer,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deal_id)
);

CREATE INDEX IF NOT EXISTS idx_traffic_hub_deliveries_pending
  ON public.traffic_hub_deliveries (status, next_attempt_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_hub_deliveries TO authenticated;
GRANT ALL ON public.traffic_hub_deliveries TO service_role;
ALTER TABLE public.traffic_hub_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traffic_hub_deliveries_admin_all" ON public.traffic_hub_deliveries
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.account_id = traffic_hub_deliveries.account_id AND (u.role = 'admin'::user_role OR u.is_also_admin = true)))
WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_user_id = auth.uid() AND u.account_id = traffic_hub_deliveries.account_id AND (u.role = 'admin'::user_role OR u.is_also_admin = true)));

CREATE OR REPLACE FUNCTION public.traffic_hub_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_traffic_hub_settings_updated ON public.traffic_hub_settings;
CREATE TRIGGER trg_traffic_hub_settings_updated BEFORE UPDATE ON public.traffic_hub_settings
FOR EACH ROW EXECUTE FUNCTION public.traffic_hub_touch_updated_at();

DROP TRIGGER IF EXISTS trg_traffic_hub_deliveries_updated ON public.traffic_hub_deliveries;
CREATE TRIGGER trg_traffic_hub_deliveries_updated BEFORE UPDATE ON public.traffic_hub_deliveries
FOR EACH ROW EXECUTE FUNCTION public.traffic_hub_touch_updated_at();

CREATE OR REPLACE FUNCTION public.enqueue_traffic_hub_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active boolean;
BEGIN
  IF NEW.status = 'won' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'won') THEN
    SELECT (s.is_active AND coalesce(s.endpoint_url, '') <> '') INTO v_active
    FROM public.traffic_hub_settings s WHERE s.account_id = NEW.account_id;

    INSERT INTO public.traffic_hub_deliveries (account_id, deal_id, status, next_attempt_at)
    VALUES (NEW.account_id, NEW.id, 'pending', now())
    ON CONFLICT (deal_id) DO UPDATE
      SET status = 'pending', next_attempt_at = now(), attempts = 0, last_error = NULL;

    IF coalesce(v_active, false) THEN
      PERFORM net.http_post(
        url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/traffic-hub-dispatch',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA"}'::jsonb,
        body := jsonb_build_object('source', 'trigger', 'deal_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enqueue_traffic_hub_delivery ON public.deals;
CREATE TRIGGER trg_enqueue_traffic_hub_delivery
AFTER INSERT OR UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.enqueue_traffic_hub_delivery();

DO $$
DECLARE jid BIGINT;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'traffic-hub-retry-hourly';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'traffic-hub-retry-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/traffic-hub-dispatch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
