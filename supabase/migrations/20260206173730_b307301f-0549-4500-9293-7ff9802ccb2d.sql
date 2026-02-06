-- Tabela de API Keys
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'API Key Principal',
  key_hash TEXT NOT NULL,
  key_preview TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id)
);

-- Tabela de logs de execução
CREATE TABLE public.api_key_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  method TEXT,
  path TEXT,
  status_code INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys"
ON api_keys FOR ALL USING (user_id IN (
  SELECT id FROM users WHERE auth_user_id = auth.uid()
));

CREATE POLICY "Users can view logs of their own keys"
ON api_key_logs FOR SELECT USING (
  api_key_id IN (
    SELECT id FROM api_keys WHERE user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);

-- Índices para performance
CREATE INDEX idx_api_key_logs_key_id ON api_key_logs(api_key_id);
CREATE INDEX idx_api_key_logs_executed_at ON api_key_logs(executed_at DESC);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);