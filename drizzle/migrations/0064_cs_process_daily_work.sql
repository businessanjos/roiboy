ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ryka_url text, ADD COLUMN IF NOT EXISTS platform_login text;

CREATE TABLE public.cs_process_waits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  client_id uuid NOT NULL,
  process_id text NOT NULL,
  step_key text NOT NULL,
  action_index int NOT NULL,
  label text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  started_by uuid,
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE UNIQUE INDEX cs_process_waits_open_uq ON public.cs_process_waits (account_id, client_id, process_id, step_key, action_index) WHERE resolved_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_process_waits TO authenticated;
GRANT ALL ON public.cs_process_waits TO service_role;
ALTER TABLE public.cs_process_waits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account waits" ON public.cs_process_waits FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id()) WITH CHECK (account_id = public.get_current_user_account_id());

CREATE TABLE public.cs_process_wait_settings (
  account_id uuid NOT NULL,
  wait_key text NOT NULL,
  alert_days int NOT NULL DEFAULT 2 CHECK (alert_days BETWEEN 1 AND 30),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, wait_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_process_wait_settings TO authenticated;
GRANT ALL ON public.cs_process_wait_settings TO service_role;
ALTER TABLE public.cs_process_wait_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account read wait settings" ON public.cs_process_wait_settings FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());
CREATE POLICY "editors write wait settings" ON public.cs_process_wait_settings FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id() AND public.is_cs_process_editor())
  WITH CHECK (account_id = public.get_current_user_account_id() AND public.is_cs_process_editor());

CREATE TABLE public.cs_today_task_states (
  account_id uuid NOT NULL,
  task_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('done','snoozed')),
  snooze_until date,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, task_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_today_task_states TO authenticated;
GRANT ALL ON public.cs_today_task_states TO service_role;
ALTER TABLE public.cs_today_task_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account task states" ON public.cs_today_task_states FOR ALL TO authenticated
  USING (account_id = public.get_current_user_account_id()) WITH CHECK (account_id = public.get_current_user_account_id());

CREATE OR REPLACE FUNCTION public.cs_last_contacts(p_user_id uuid)
RETURNS TABLE(client_id uuid, full_name text, last_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, c.full_name, (SELECT max(k.happened_at) FROM client_checkins k WHERE k.client_id = c.id)
  FROM clients c
  WHERE c.account_id = public.get_current_user_account_id()
    AND c.status = 'active'
    AND (p_user_id IS NULL OR c.responsible_user_id = p_user_id)
$$;
GRANT EXECUTE ON FUNCTION public.cs_last_contacts(uuid) TO authenticated;