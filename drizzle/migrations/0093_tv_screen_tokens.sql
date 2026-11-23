CREATE TABLE public.tv_screen_tokens (
  slot integer PRIMARY KEY REFERENCES public.tv_screens(slot) ON DELETE CASCADE,
  nonce text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  last_used_at timestamptz
);
GRANT SELECT (slot, created_at, last_used_at) ON public.tv_screen_tokens TO authenticated;
GRANT ALL ON public.tv_screen_tokens TO service_role;
ALTER TABLE public.tv_screen_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv managers read key info" ON public.tv_screen_tokens FOR SELECT TO authenticated USING (public.tv_can_manage(auth.uid()));
COMMENT ON TABLE public.tv_screen_tokens IS 'One active TV key per slot. Only nonce + sha256 hash stored; value derived server-side with TV_TOKEN_SECRET. Writes only via edge function tv-token.';