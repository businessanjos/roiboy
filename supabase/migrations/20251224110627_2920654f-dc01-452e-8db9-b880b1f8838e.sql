-- Add instagram field to clients table
ALTER TABLE public.clients
ADD COLUMN instagram text;

-- Add show_instagram setting to members_book_settings
ALTER TABLE public.members_book_settings
ADD COLUMN show_instagram boolean NOT NULL DEFAULT true;