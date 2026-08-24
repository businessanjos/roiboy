CREATE TABLE IF NOT EXISTS public.internal_cron_tokens (
  name TEXT PRIMARY KEY,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_cron_tokens TO service_role;
ALTER TABLE public.internal_cron_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only"
  ON public.internal_cron_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.internal_cron_tokens (name)
VALUES ('threecplus_sync')
ON CONFLICT (name) DO NOTHING;