-- Add sentiment column to whatsapp_groups
ALTER TABLE public.whatsapp_groups 
ADD COLUMN IF NOT EXISTS sentiment text DEFAULT 'neutral' CHECK (sentiment IN ('engaged', 'neutral', 'dead'));

-- Add last_sentiment_check to track when sentiment was last analyzed
ALTER TABLE public.whatsapp_groups 
ADD COLUMN IF NOT EXISTS last_sentiment_check timestamp with time zone;

-- Add sentiment_reason to explain why the group has that sentiment
ALTER TABLE public.whatsapp_groups 
ADD COLUMN IF NOT EXISTS sentiment_reason text;