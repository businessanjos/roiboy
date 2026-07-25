CREATE TABLE IF NOT EXISTS public.zapp_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  action text NOT NULL,
  sector_id text,
  zapp_conversation_id uuid,
  assignment_id uuid,
  from_agent_id uuid,
  to_agent_id uuid,
  from_department_id uuid,
  to_department_id uuid,
  reason text,
  actor_user_id uuid,
  actor_auth_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zapp_audit_logs TO authenticated;
GRANT ALL ON public.zapp_audit_logs TO service_role;

ALTER TABLE public.zapp_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zapp_audit_select_account" ON public.zapp_audit_logs;
CREATE POLICY "zapp_audit_select_account" ON public.zapp_audit_logs
  FOR SELECT TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE INDEX IF NOT EXISTS idx_zapp_audit_logs_account_created
  ON public.zapp_audit_logs (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zapp_audit_logs_conversation
  ON public.zapp_audit_logs (zapp_conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_zapp_assignment_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_actor uuid;
  v_sector text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.agent_id IS NULL AND NEW.department_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_action := 'assign';
  ELSE
    IF NEW.agent_id IS DISTINCT FROM OLD.agent_id AND NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      v_action := 'transfer';
    ELSIF NEW.agent_id IS DISTINCT FROM OLD.agent_id THEN
      v_action := CASE WHEN OLD.agent_id IS NULL THEN 'assign' ELSE 'reassign' END;
    ELSIF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      v_action := 'transfer';
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_actor FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT sector_id INTO v_sector
  FROM public.zapp_conversations
  WHERE id = NEW.zapp_conversation_id;

  INSERT INTO public.zapp_audit_logs (
    account_id, action, sector_id, zapp_conversation_id, assignment_id,
    from_agent_id, to_agent_id, from_department_id, to_department_id,
    actor_user_id, actor_auth_user_id
  ) VALUES (
    NEW.account_id, v_action, v_sector, NEW.zapp_conversation_id, NEW.id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.agent_id ELSE NULL END,
    NEW.agent_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.department_id ELSE NULL END,
    NEW.department_id,
    v_actor, auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zapp_assignment_audit ON public.zapp_conversation_assignments;
CREATE TRIGGER trg_zapp_assignment_audit
AFTER INSERT OR UPDATE OF agent_id, department_id ON public.zapp_conversation_assignments
FOR EACH ROW EXECUTE FUNCTION public.log_zapp_assignment_audit();