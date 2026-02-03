-- Add synced_from_history column to track messages imported from UAZAPI history
ALTER TABLE public.zapp_messages 
ADD COLUMN IF NOT EXISTS synced_from_history boolean DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN public.zapp_messages.synced_from_history IS 'True if this message was synced from UAZAPI message history (not received via webhook)';