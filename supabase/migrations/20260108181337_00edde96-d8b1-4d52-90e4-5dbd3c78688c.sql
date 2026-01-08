-- Add link_clicks column to instagram_posts table
ALTER TABLE public.instagram_posts 
ADD COLUMN link_clicks integer NOT NULL DEFAULT 0;