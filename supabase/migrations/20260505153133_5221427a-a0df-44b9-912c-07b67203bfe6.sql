
-- Audit log for hr_collaborators changes
CREATE TABLE IF NOT EXISTS public.hr_collaborator_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  collaborator_id uuid NOT NULL REFERENCES public.hr_collaborators(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  user_email text,
  action text NOT NULL,
  changed_fields jsonb,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_collab_audit_collab ON public.hr_collaborator_audit_log(collaborator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_collab_audit_account ON public.hr_collaborator_audit_log(account_id, created_at DESC);

ALTER TABLE public.hr_collaborator_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit of their account"
ON public.hr_collaborator_audit_log
FOR SELECT
USING (account_id = public.get_current_user_account_id());

CREATE POLICY "System can insert audit logs"
ON public.hr_collaborator_audit_log
FOR INSERT
WITH CHECK (true);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_hr_collaborator_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
  v_user_email text;
  v_changed jsonb := '{}'::jsonb;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_old_row jsonb;
  v_new_row jsonb;
  v_key text;
BEGIN
  SELECT id, name, email INTO v_user_id, v_user_name, v_user_email
  FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hr_collaborator_audit_log (
      account_id, collaborator_id, user_id, user_name, user_email,
      action, new_values
    ) VALUES (
      NEW.account_id, NEW.id, v_user_id, v_user_name, v_user_email,
      'create', to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_row := to_jsonb(OLD);
    v_new_row := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new_row) LOOP
      IF v_key IN ('updated_at') THEN CONTINUE; END IF;
      IF v_old_row->v_key IS DISTINCT FROM v_new_row->v_key THEN
        v_changed := v_changed || jsonb_build_object(v_key, true);
        v_old := v_old || jsonb_build_object(v_key, v_old_row->v_key);
        v_new := v_new || jsonb_build_object(v_key, v_new_row->v_key);
      END IF;
    END LOOP;
    IF v_changed <> '{}'::jsonb THEN
      INSERT INTO public.hr_collaborator_audit_log (
        account_id, collaborator_id, user_id, user_name, user_email,
        action, changed_fields, old_values, new_values
      ) VALUES (
        NEW.account_id, NEW.id, v_user_id, v_user_name, v_user_email,
        'update', v_changed, v_old, v_new
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.hr_collaborator_audit_log (
      account_id, collaborator_id, user_id, user_name, user_email,
      action, old_values
    ) VALUES (
      OLD.account_id, OLD.id, v_user_id, v_user_name, v_user_email,
      'delete', to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_hr_collab_audit ON public.hr_collaborators;
CREATE TRIGGER trg_hr_collab_audit
AFTER INSERT OR UPDATE OR DELETE ON public.hr_collaborators
FOR EACH ROW EXECUTE FUNCTION public.log_hr_collaborator_changes();
