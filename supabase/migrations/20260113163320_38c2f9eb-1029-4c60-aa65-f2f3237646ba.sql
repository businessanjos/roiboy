-- Add is_system_default column to track which options were originally defaults
ALTER TABLE instagram_post_options 
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;