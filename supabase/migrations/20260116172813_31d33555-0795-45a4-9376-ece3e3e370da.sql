-- Add reposts column to instagram_posts table
ALTER TABLE instagram_posts ADD COLUMN IF NOT EXISTS reposts INTEGER DEFAULT 0;