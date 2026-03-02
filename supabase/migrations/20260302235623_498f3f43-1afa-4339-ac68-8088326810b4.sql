
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification when a notification is inserted
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Get Supabase URL and service role key from vault or env
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  -- If settings not available, try direct env
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Use the known project URL
    v_supabase_url := 'https://mtzoavtbtqflufyccern.supabase.co';
  END IF;
  
  -- Only proceed if we have the service key
  IF v_service_key IS NOT NULL AND v_service_key != '' THEN
    PERFORM extensions.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', COALESCE(NEW.content, ''),
        'url', COALESCE(NEW.link, '/'),
        'tag', 'notification-' || NEW.id::text
      )::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      )::jsonb
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail the notification insert if push fails
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications;
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_push_on_notification();
