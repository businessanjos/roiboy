CREATE TABLE public.instagram_feed_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.instagram_profiles(id),
  post_date date NOT NULL,
  description text,
  link_url text,
  views integer NOT NULL DEFAULT 0,
  link_clicks integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_feed_link_clicks TO authenticated;
GRANT ALL ON public.instagram_feed_link_clicks TO service_role;
ALTER TABLE public.instagram_feed_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed clicks same account" ON public.instagram_feed_link_clicks FOR ALL TO authenticated
USING (account_id = public.get_current_user_account_id())
WITH CHECK (
  account_id = public.get_current_user_account_id()
  AND EXISTS (
    SELECT 1 FROM public.instagram_profiles p
    WHERE p.id = profile_id AND p.account_id = instagram_feed_link_clicks.account_id
  )
);
CREATE INDEX instagram_feed_link_clicks_profile_date_idx ON public.instagram_feed_link_clicks (profile_id, post_date);