-- Add followers_gained column to instagram_posts
ALTER TABLE public.instagram_posts 
ADD COLUMN followers_gained integer DEFAULT 0;