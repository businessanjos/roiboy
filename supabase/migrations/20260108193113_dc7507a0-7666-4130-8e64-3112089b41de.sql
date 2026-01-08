-- Add collaborator column to instagram_posts
ALTER TABLE public.instagram_posts 
ADD COLUMN collaborator TEXT;