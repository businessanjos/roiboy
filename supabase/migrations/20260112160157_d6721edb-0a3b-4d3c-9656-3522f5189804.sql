-- Add views column to instagram_posts table
ALTER TABLE instagram_posts 
ADD COLUMN views integer NOT NULL DEFAULT 0;