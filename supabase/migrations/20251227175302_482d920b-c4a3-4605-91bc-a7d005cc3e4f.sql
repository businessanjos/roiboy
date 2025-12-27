-- Add instagrams column as JSON array (like emails and additional_phones)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS instagrams jsonb DEFAULT '[]'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.clients.instagrams IS 'Array of Instagram usernames (without @)';