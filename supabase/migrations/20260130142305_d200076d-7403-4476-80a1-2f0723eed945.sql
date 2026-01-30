-- Add columns for scheduled auto-send functionality
ALTER TABLE public.client_life_events 
ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS send_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS send_error TEXT,
ADD COLUMN IF NOT EXISTS integration_id UUID;

-- Add constraint for send_status values
ALTER TABLE public.client_life_events 
ADD CONSTRAINT client_life_events_send_status_check 
CHECK (send_status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled'));

-- Add index for efficient querying of scheduled moments
CREATE INDEX IF NOT EXISTS idx_client_life_events_scheduled 
ON public.client_life_events (scheduled_send_at, send_status) 
WHERE scheduled_send_at IS NOT NULL AND send_status = 'scheduled';