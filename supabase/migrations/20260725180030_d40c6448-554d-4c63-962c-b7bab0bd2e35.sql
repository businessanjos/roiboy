CREATE TABLE public.user_royzapp_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  views text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_royzapp_views TO authenticated;
GRANT ALL ON public.user_royzapp_views TO service_role;

ALTER TABLE public.user_royzapp_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view royzapp views in their account"
ON public.user_royzapp_views FOR SELECT TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can insert royzapp views in their account"
ON public.user_royzapp_views FOR INSERT TO authenticated
WITH CHECK (account_id = get_user_account_id());

CREATE POLICY "Users can update royzapp views in their account"
ON public.user_royzapp_views FOR UPDATE TO authenticated
USING (account_id = get_user_account_id());

CREATE POLICY "Users can delete royzapp views in their account"
ON public.user_royzapp_views FOR DELETE TO authenticated
USING (account_id = get_user_account_id());

CREATE TRIGGER trg_user_royzapp_views_updated_at
BEFORE UPDATE ON public.user_royzapp_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();