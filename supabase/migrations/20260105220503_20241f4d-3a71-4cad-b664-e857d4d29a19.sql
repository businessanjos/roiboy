-- Add target_deal_stages column to events table (JSON array of stage IDs)
ALTER TABLE public.events 
ADD COLUMN target_deal_stages jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.events.target_deal_stages IS 'Array of deal_stage IDs that can be invited to this marketing event';