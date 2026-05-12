
CREATE TABLE IF NOT EXISTS public.marketing_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  created_by_user_id uuid,
  name text NOT NULL,
  destination_url text NOT NULL,
  full_url text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  meta_campaign_id text,
  meta_campaign_name text,
  event_id uuid,
  seller_user_id uuid,
  tags text[] DEFAULT '{}'::text[],
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_links_account ON public.marketing_links(account_id);
CREATE INDEX IF NOT EXISTS idx_marketing_links_campaign ON public.marketing_links(account_id, utm_campaign);
CREATE INDEX IF NOT EXISTS idx_marketing_links_created ON public.marketing_links(account_id, created_at DESC);

ALTER TABLE public.marketing_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_links_select_same_account"
  ON public.marketing_links FOR SELECT
  USING (account_id = public.get_user_account_id());

CREATE POLICY "marketing_links_insert_same_account"
  ON public.marketing_links FOR INSERT
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "marketing_links_update_same_account"
  ON public.marketing_links FOR UPDATE
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "marketing_links_delete_same_account"
  ON public.marketing_links FOR DELETE
  USING (account_id = public.get_user_account_id());

CREATE TRIGGER trg_marketing_links_updated_at
  BEFORE UPDATE ON public.marketing_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
