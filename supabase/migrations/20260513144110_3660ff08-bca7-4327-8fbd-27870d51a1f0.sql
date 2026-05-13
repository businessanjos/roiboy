CREATE TABLE public.call_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  notes text,
  call_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage call links of their account"
ON public.call_links
FOR ALL
USING (account_id = get_my_account_id())
WITH CHECK (account_id = get_my_account_id());

CREATE INDEX idx_call_links_account ON public.call_links(account_id, created_at DESC);

CREATE TRIGGER trg_call_links_updated_at
BEFORE UPDATE ON public.call_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();