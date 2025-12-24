-- Add bio field to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS bio text;

-- Add show_bio setting to members_book_settings
ALTER TABLE public.members_book_settings ADD COLUMN IF NOT EXISTS show_bio boolean DEFAULT true;