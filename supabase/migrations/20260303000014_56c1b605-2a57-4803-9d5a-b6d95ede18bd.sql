
-- Fix the function to use correct pg_net syntax with anon key (publishable)
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Use pg_net to call send-push edge function
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
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;
