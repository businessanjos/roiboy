-- Add show_in_clients column to custom_fields table
-- Default true for backward compatibility (existing fields continue visible in clients)
ALTER TABLE public.custom_fields 
ADD COLUMN show_in_clients boolean NOT NULL DEFAULT true;