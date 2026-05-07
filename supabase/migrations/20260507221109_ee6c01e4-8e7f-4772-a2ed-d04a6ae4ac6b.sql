CREATE TABLE IF NOT EXISTS public.client_instagram_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  full_name TEXT,
  biography TEXT,
  profile_pic_url TEXT,
  external_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE,
  is_business BOOLEAN DEFAULT FALSE,
  category TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  posts JSONB DEFAULT '[]'::jsonb,
  raw JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, username)
);

CREATE INDEX IF NOT EXISTS idx_client_ig_snap_client ON public.client_instagram_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_client_ig_snap_account ON public.client_instagram_snapshots(account_id);

ALTER TABLE public.client_instagram_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view IG snapshots"
ON public.client_instagram_snapshots FOR SELECT
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert IG snapshots"
ON public.client_instagram_snapshots FOR INSERT
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can update IG snapshots"
ON public.client_instagram_snapshots FOR UPDATE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can delete IG snapshots"
ON public.client_instagram_snapshots FOR DELETE
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_client_ig_snap_updated
BEFORE UPDATE ON public.client_instagram_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();