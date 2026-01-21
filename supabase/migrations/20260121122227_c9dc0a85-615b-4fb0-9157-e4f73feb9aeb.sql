-- Add signature columns to users table for RoyZapp
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS zapp_signature TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS zapp_signature_enabled BOOLEAN DEFAULT false;