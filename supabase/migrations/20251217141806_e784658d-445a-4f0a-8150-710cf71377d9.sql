-- Add image_url column to risk_events for storing screenshot attachments
ALTER TABLE public.risk_events ADD COLUMN image_url TEXT;