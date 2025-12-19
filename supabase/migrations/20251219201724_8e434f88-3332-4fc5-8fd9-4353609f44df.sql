-- Add logo_url column to clients table for client branding
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS logo_url text;