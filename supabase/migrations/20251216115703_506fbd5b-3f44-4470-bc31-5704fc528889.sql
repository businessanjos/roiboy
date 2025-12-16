-- Create enum for event modality
CREATE TYPE public.event_modality AS ENUM ('online', 'presencial');

-- Add modality column to events table
ALTER TABLE public.events 
ADD COLUMN modality public.event_modality NOT NULL DEFAULT 'online';