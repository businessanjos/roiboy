-- Step 1: Create category enum and add new event types
CREATE TYPE public.event_category AS ENUM ('operation', 'marketing');

-- Add new event types for marketing
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'launch';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'campaign';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'content';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'partnership';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'fair';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'other';

-- Add new columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS category public.event_category NOT NULL DEFAULT 'operation',
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS goals text,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS start_time time without time zone,
ADD COLUMN IF NOT EXISTS end_time time without time zone;