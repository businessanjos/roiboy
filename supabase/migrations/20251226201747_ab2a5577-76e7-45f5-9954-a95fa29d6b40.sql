-- Add delivery_status column to zapp_messages
ALTER TABLE public.zapp_messages 
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent';

-- Add check constraint for valid status values
ALTER TABLE public.zapp_messages 
ADD CONSTRAINT zapp_messages_delivery_status_check 
CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed'));

-- Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_zapp_messages_delivery_status 
ON public.zapp_messages(delivery_status);

-- Create index for external_message_id for status updates
CREATE INDEX IF NOT EXISTS idx_zapp_messages_external_id 
ON public.zapp_messages(external_message_id) WHERE external_message_id IS NOT NULL;