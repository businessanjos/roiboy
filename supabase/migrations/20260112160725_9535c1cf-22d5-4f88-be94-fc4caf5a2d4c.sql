-- Add theme column to instagram_posts table
ALTER TABLE instagram_posts 
ADD COLUMN theme text DEFAULT NULL;