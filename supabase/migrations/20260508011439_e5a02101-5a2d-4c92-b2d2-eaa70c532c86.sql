
CREATE TABLE public.client_instagram_metrics_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  client_id uuid NOT NULL,
  username text NOT NULL,
  followers_count integer,
  following_count integer,
  media_count integer,
  snapshot_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ig_metrics_history_client ON public.client_instagram_metrics_history (client_id, username, snapshot_at DESC);
CREATE INDEX idx_ig_metrics_history_account ON public.client_instagram_metrics_history (account_id);

ALTER TABLE public.client_instagram_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view IG metrics history"
ON public.client_instagram_metrics_history
FOR SELECT
USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert IG metrics history"
ON public.client_instagram_metrics_history
FOR INSERT
WITH CHECK (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));
