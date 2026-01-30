-- Add message column to client_life_events for customer-facing messages
ALTER TABLE public.client_life_events 
ADD COLUMN message TEXT;