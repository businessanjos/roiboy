-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mention',
  title TEXT NOT NULL,
  content TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Reference to the source (e.g., followup_id, client_id)
  source_type TEXT,
  source_id UUID,
  -- Who triggered the notification
  triggered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id IN (SELECT id FROM public.users WHERE account_id = public.get_user_account_id()));

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id IN (SELECT id FROM public.users WHERE account_id = public.get_user_account_id()));

CREATE POLICY "Users can insert notifications for same account"
ON public.notifications FOR INSERT
WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (user_id IN (SELECT id FROM public.users WHERE account_id = public.get_user_account_id()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(user_id, is_read);