ALTER TABLE public.threecplus_agents ADD COLUMN IF NOT EXISTS api_token TEXT;
ALTER TABLE public.threecplus_agents ADD COLUMN IF NOT EXISTS token_status TEXT NOT NULL DEFAULT 'missing';
ALTER TABLE public.threecplus_agents ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Autenticados podem gravar o token, mas não lê-lo (leitura só service_role)
REVOKE SELECT ON public.threecplus_agents FROM authenticated;
GRANT SELECT (id, account_id, external_agent_id, external_name, external_email, user_id,
              is_tracked, token_status, last_synced_at, created_at, updated_at)
  ON public.threecplus_agents TO authenticated;