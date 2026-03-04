CREATE OR REPLACE FUNCTION public.notify_task_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assigner_name TEXT;
  client_name TEXT;
  v_sector_id TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    
    IF TG_OP = 'INSERT' AND NEW.created_by = NEW.assigned_to THEN
      RETURN NEW;
    END IF;
    
    SELECT name INTO assigner_name 
    FROM public.users 
    WHERE id = COALESCE(
      CASE WHEN TG_OP = 'UPDATE' THEN (SELECT id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1) END,
      NEW.created_by
    );
    
    IF NEW.client_id IS NOT NULL THEN
      SELECT full_name INTO client_name FROM public.clients WHERE id = NEW.client_id;
      v_sector_id := 'operacoes';
    ELSE
      v_sector_id := CASE WHEN NEW.deal_id IS NOT NULL THEN 'vendas' ELSE 'operacoes' END;
    END IF;
    
    INSERT INTO public.notifications (
      account_id, user_id, type, title, content, link,
      source_type, source_id, triggered_by_user_id, sector_id
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
      END,
      v_sector_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;