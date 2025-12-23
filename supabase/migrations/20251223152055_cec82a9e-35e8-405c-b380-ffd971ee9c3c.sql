-- Add scheduling columns to reminder_campaigns
ALTER TABLE public.reminder_campaigns 
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS auto_type TEXT DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.reminder_campaigns.scheduled_for IS 'When the campaign should be automatically sent';
COMMENT ON COLUMN public.reminder_campaigns.auto_type IS 'Type of auto-reminder: pre_event_24h, pre_event_1h, post_event_feedback, rsvp_reminder';

-- Create index for efficient querying of scheduled campaigns
CREATE INDEX IF NOT EXISTS idx_reminder_campaigns_scheduled 
ON public.reminder_campaigns (scheduled_for, status) 
WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;