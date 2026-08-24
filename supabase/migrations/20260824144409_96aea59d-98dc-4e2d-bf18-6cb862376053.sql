-- 1. Call logs: allow external agents without ROY user + dedupe key
ALTER TABLE public.threecplus_call_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.threecplus_call_logs ADD COLUMN IF NOT EXISTS agent_external_id TEXT;
ALTER TABLE public.threecplus_call_logs ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.threecplus_call_logs ADD COLUMN IF NOT EXISTS agent_email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS threecplus_call_logs_account_call_id_key
  ON public.threecplus_call_logs (account_id, call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS threecplus_call_logs_started_at_idx
  ON public.threecplus_call_logs (account_id, started_at DESC);

-- 2. Agent mapping
CREATE TABLE IF NOT EXISTS public.threecplus_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  external_agent_id TEXT NOT NULL,
  external_name TEXT,
  external_email TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_tracked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_agent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threecplus_agents TO authenticated;
GRANT ALL ON public.threecplus_agents TO service_role;
ALTER TABLE public.threecplus_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account 3c agents"
  ON public.threecplus_agents FOR SELECT TO authenticated
  USING (account_id = get_current_user_account_id());
CREATE POLICY "Users can insert account 3c agents"
  ON public.threecplus_agents FOR INSERT TO authenticated
  WITH CHECK (account_id = get_current_user_account_id());
CREATE POLICY "Users can update account 3c agents"
  ON public.threecplus_agents FOR UPDATE TO authenticated
  USING (account_id = get_current_user_account_id())
  WITH CHECK (account_id = get_current_user_account_id());
CREATE POLICY "Users can delete account 3c agents"
  ON public.threecplus_agents FOR DELETE TO authenticated
  USING (account_id = get_current_user_account_id());

CREATE TRIGGER update_threecplus_agents_updated_at
  BEFORE UPDATE ON public.threecplus_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Sync state (single-flight + circuit breaker)
CREATE TABLE IF NOT EXISTS public.threecplus_sync_state (
  account_id UUID NOT NULL PRIMARY KEY,
  last_synced_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'idle',
  is_paused BOOLEAN NOT NULL DEFAULT false,
  last_error TEXT,
  calls_synced INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.threecplus_sync_state TO authenticated;
GRANT ALL ON public.threecplus_sync_state TO service_role;
ALTER TABLE public.threecplus_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view account 3c sync state"
  ON public.threecplus_sync_state FOR SELECT TO authenticated
  USING (account_id = get_current_user_account_id());
CREATE POLICY "Users can upsert account 3c sync state"
  ON public.threecplus_sync_state FOR INSERT TO authenticated
  WITH CHECK (account_id = get_current_user_account_id());
CREATE POLICY "Users can update account 3c sync state"
  ON public.threecplus_sync_state FOR UPDATE TO authenticated
  USING (account_id = get_current_user_account_id())
  WITH CHECK (account_id = get_current_user_account_id());

CREATE TRIGGER update_threecplus_sync_state_updated_at
  BEFORE UPDATE ON public.threecplus_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();