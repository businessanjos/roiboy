CREATE OR REPLACE FUNCTION public.log_hr_collaborator_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
  v_user_email text;
BEGIN
  BEGIN
    SELECT id, name, email INTO v_user_id, v_user_name, v_user_email
    FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hr_collaborator_audit_log (
      account_id, collaborator_id, user_id, user_name, user_email,
      action, new_values
    ) VALUES (
      NEW.account_id, NEW.id, v_user_id, v_user_name, v_user_email,
      'insert', to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.hr_collaborator_audit_log (
      account_id, collaborator_id, user_id, user_name, user_email,
      action, old_values, new_values
    ) VALUES (
      NEW.account_id, NEW.id, v_user_id, v_user_name, v_user_email,
      'update', to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.hr_collaborator_audit_log (
      account_id, collaborator_id, user_id, user_name, user_email,
      action, old_values
    ) VALUES (
      OLD.account_id, NULL, v_user_id, v_user_name, v_user_email,
      'delete', to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;