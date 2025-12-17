-- Add avatar_url column to clients table
ALTER TABLE public.clients 
ADD COLUMN avatar_url text;