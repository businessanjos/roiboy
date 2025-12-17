-- Function to notify when task is assigned
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigner_name TEXT;
  client_name TEXT;
BEGIN
  -- Only notify if assigned_to is set and changed (or new insert with assignment)
  IF NEW.assigned_to IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    
    -- Don't notify if assigning to self on creation
    IF TG_OP = 'INSERT' AND NEW.created_by = NEW.assigned_to THEN
      RETURN NEW;
    END IF;
    
    -- Get assigner name
    SELECT name INTO assigner_name 
    FROM public.users 
    WHERE id = COALESCE(
      CASE WHEN TG_OP = 'UPDATE' THEN (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1) END,
      NEW.created_by
    );
    
    -- Get client name if linked
    IF NEW.client_id IS NOT NULL THEN
      SELECT full_name INTO client_name FROM public.clients WHERE id = NEW.client_id;
    END IF;
    
    -- Create notification for assigned user
    INSERT INTO public.notifications (
      account_id,
      user_id,
      type,
      title,
      content,
      link,
      source_type,
      source_id,
      triggered_by_user_id
    ) VALUES (
      NEW.account_id,
      NEW.assigned_to,
      'task_assigned',
      'Nova tarefa atribuída',
      CASE 
        WHEN client_name IS NOT NULL THEN 
          '"' || NEW.title || '" foi atribuída a você por ' || COALESCE(assigner_name, 'alguém') || ' (Cliente: ' || client_name || ')'
        ELSE 
          '"' || NEW.title || '" foi atribuída a você por ' || COALESCE(assigner_name, 'alguém')
      END,
      CASE 
        WHEN NEW.client_id IS NOT NULL THEN '/clients/' || NEW.client_id
        ELSE '/tasks'
      END,
      'internal_task',
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN 
        (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1)
      ELSE 
        NEW.created_by 
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task assignment notifications
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.internal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();