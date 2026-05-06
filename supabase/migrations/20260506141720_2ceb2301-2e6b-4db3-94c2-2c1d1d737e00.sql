CREATE TABLE public.meta_campaign_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ad_account_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  cpl_max NUMERIC,
  roas_min NUMERIC,
  ctr_min NUMERIC,
  frequency_max NUMERIC,
  spend_daily_max NUMERIC,
  cooldown_hours INTEGER NOT NULL DEFAULT 6,
  notify_user_ids UUID[] NOT NULL DEFAULT '{}',
  date_preset TEXT NOT NULL DEFAULT 'last_3d',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mca_campaign ON public.meta_campaign_alerts (campaign_id);
CREATE INDEX idx_mca_account ON public.meta_campaign_alerts (account_id);

CREATE TABLE public.meta_campaign_alert_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.meta_campaign_alerts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  campaign_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  threshold NUMERIC,
  observed_value NUMERIC,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcae_alert ON public.meta_campaign_alert_events (alert_id, created_at DESC);

ALTER TABLE public.meta_campaign_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaign_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view alerts"
ON public.meta_campaign_alerts FOR SELECT TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert alerts"
ON public.meta_campaign_alerts FOR INSERT TO authenticated
WITH CHECK (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can update alerts"
ON public.meta_campaign_alerts FOR UPDATE TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can delete alerts"
ON public.meta_campaign_alerts FOR DELETE TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE POLICY "Account members can view alert events"
ON public.meta_campaign_alert_events FOR SELECT TO authenticated
USING (account_id IN (SELECT u.account_id FROM public.users u WHERE u.auth_user_id = auth.uid()));

CREATE TRIGGER trg_mca_updated_at
BEFORE UPDATE ON public.meta_campaign_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
