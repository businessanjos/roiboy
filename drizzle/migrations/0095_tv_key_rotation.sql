ALTER TABLE public.tv_screen_tokens
  ADD COLUMN prev_nonce text,
  ADD COLUMN prev_token_hash text UNIQUE,
  ADD COLUMN prev_expires_at timestamptz;
COMMENT ON TABLE public.tv_screen_tokens IS 'One active TV key per slot (+ previous key valid until prev_expires_at). Only nonce + sha256 stored; created/rotated monthly by tv-agent, emergency rotate via edge function tv-token.';