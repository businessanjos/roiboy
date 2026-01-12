-- Add new columns to instagram_posts table
ALTER TABLE instagram_posts 
ADD COLUMN IF NOT EXISTS specialist_version TEXT NULL,
ADD COLUMN IF NOT EXISTS composition TEXT[] NULL DEFAULT '{}';

-- Create table for customizable options
CREATE TABLE IF NOT EXISTS instagram_post_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  option_type TEXT NOT NULL CHECK (option_type IN ('specialist_version', 'composition')),
  value TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, option_type, value)
);

-- Enable RLS
ALTER TABLE instagram_post_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view options from their account"
ON instagram_post_options FOR SELECT
USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can insert options to their account"
ON instagram_post_options FOR INSERT
WITH CHECK (account_id = public.get_my_account_id());

CREATE POLICY "Users can update options from their account"
ON instagram_post_options FOR UPDATE
USING (account_id = public.get_my_account_id());

CREATE POLICY "Users can delete options from their account"
ON instagram_post_options FOR DELETE
USING (account_id = public.get_my_account_id());