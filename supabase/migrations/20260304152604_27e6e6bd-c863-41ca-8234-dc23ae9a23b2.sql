
-- Table for push notification preferences per user
CREATE TABLE public.push_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  notify_zapp_messages boolean NOT NULL DEFAULT true,
  notify_task_assigned boolean NOT NULL DEFAULT true,
  notify_mentions boolean NOT NULL DEFAULT true,
  notify_system_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.push_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own preferences
CREATE POLICY "Users can manage own push preferences"
  ON public.push_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = public.get_current_user_id())
  WITH CHECK (user_id = public.get_current_user_id());

-- Replace the trigger function to check preferences before sending push
CREATE OR REPLACE FUNCTION public.send_push_on_notification()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_should_send boolean := true;
  v_category text;
BEGIN
  -- Map notification type to preference category
  v_category := CASE
    WHEN NEW.type IN ('zapp_message', 'zapp_new_message', 'new_message') THEN 'zapp_messages'
    WHEN NEW.type = 'task_assigned' THEN 'task_assigned'
    WHEN NEW.type = 'mention' THEN 'mentions'
    ELSE 'system_alerts'
  END;

  -- Check user preferences
  SELECT CASE v_category
    WHEN 'zapp_messages' THEN notify_zapp_messages
    WHEN 'task_assigned' THEN notify_task_assigned
    WHEN 'mentions' THEN notify_mentions
    WHEN 'system_alerts' THEN notify_system_alerts
    ELSE true
  END INTO v_should_send
  FROM public.push_notification_preferences
  WHERE user_id = NEW.user_id;

  -- If no preferences row exists, default to sending (true)
  IF NOT FOUND THEN
    v_should_send := true;
  END IF;

  -- Only send push if the category is enabled
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
