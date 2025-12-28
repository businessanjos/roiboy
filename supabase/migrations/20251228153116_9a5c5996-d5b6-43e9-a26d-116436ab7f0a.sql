-- Add lead_id column to zapp_conversations to link conversations to leads
ALTER TABLE public.zapp_conversations ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_lead_id ON public.zapp_conversations(lead_id);