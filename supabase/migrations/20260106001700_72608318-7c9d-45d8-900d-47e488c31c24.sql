-- Add due_time column to internal_tasks
ALTER TABLE public.internal_tasks 
ADD COLUMN due_time TIME WITHOUT TIME ZONE;