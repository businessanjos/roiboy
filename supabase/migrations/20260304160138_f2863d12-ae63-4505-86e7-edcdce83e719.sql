
-- 1. Add sector_id to notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sector_id text;

-- 2. Add notify_sectors to push_notification_preferences
ALTER TABLE public.push_notification_preferences ADD COLUMN IF NOT EXISTS notify_sectors jsonb DEFAULT NULL;

-- 3. Update the send_push_on_notification function to also check sector preferences
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_should_send boolean := true;
  v_category text;
  v_user_sectors jsonb;
BEGIN
  -- Map notification type to preference category
  v_category := CASE
    WHEN NEW.type IN ('zapp_message', 'zapp_new_message', 'new_message') THEN 'zapp_messages'
    WHEN NEW.type = 'task_assigned' THEN 'task_assigned'
    WHEN NEW.type = 'mention' THEN 'mentions'
    ELSE 'system_alerts'
  END;

  -- Check user preferences (type + sector)
  SELECT 
    CASE v_category
      WHEN 'zapp_messages' THEN notify_zapp_messages
      WHEN 'task_assigned' THEN notify_task_assigned
      WHEN 'mentions' THEN notify_mentions
      WHEN 'system_alerts' THEN notify_system_alerts
      ELSE true
    END,
    notify_sectors
  INTO v_should_send, v_user_sectors
  FROM public.push_notification_preferences
  WHERE user_id = NEW.user_id;

  -- If no preferences row exists, default to sending (true)
  IF NOT FOUND THEN
    v_should_send := true;
    v_user_sectors := NULL;
  END IF;

  -- Check sector filter: if user has sector preferences AND notification has a sector_id,
  -- only send if the notification's sector is in the user's allowed sectors
  IF v_should_send AND v_user_sectors IS NOT NULL AND jsonb_array_length(v_user_sectors) > 0 AND NEW.sector_id IS NOT NULL THEN
    IF NOT v_user_sectors ? NEW.sector_id THEN
      v_should_send := false;
    END IF;
  END IF;

  -- Only send push if the category is enabled and sector matches
  IF v_should_send THEN
    PERFORM net.http_post(
      url := 'https://mtzoavtbtqflufyccern.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10em9hdnRidHFmbHVmeWNjZXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NDQ2MDYsImV4cCI6MjA4MTQyMDYwNn0.aFVdVFXwpE7iU7G_u-Ehh-FBFxH32fHiZVo8-RzRGUA'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', COALESCE(NEW.content, ''),
        'url', COALESCE(NEW.link, '/'),
        'tag', 'notification-' || NEW.id::text
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

-- 4. Update notify_task_assignment to include sector_id based on task context
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
      v_sector_id := COALESCE(NEW.sector_id, 'operacoes');
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
