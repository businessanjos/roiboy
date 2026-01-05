-- Add avatar_url column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.avatar_url IS 'URL of the lead profile photo, can be set manually or automatically from WhatsApp';