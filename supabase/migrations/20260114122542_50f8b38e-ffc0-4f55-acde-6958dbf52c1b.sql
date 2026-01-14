-- Create user_instance_preferences table for storing user's preferred instance per sector
CREATE TABLE public.user_instance_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, account_id, sector_id)
);

-- Enable RLS
ALTER TABLE public.user_instance_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage their own preferences
CREATE POLICY "Users can view their own instance preferences"
ON public.user_instance_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instance preferences"
ON public.user_instance_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own instance preferences"
ON public.user_instance_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own instance preferences"
ON public.user_instance_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Add integration_id column to zapp_conversations to track which instance the conversation belongs to
ALTER TABLE public.zapp_conversations
ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_zapp_conversations_integration_id 
ON public.zapp_conversations(integration_id);

CREATE INDEX IF NOT EXISTS idx_user_instance_preferences_user_sector
ON public.user_instance_preferences(user_id, sector_id);

-- Enable realtime for user_instance_preferences
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_instance_preferences;