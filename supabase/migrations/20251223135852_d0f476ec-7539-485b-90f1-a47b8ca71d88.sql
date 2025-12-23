-- Add 'mentor' to the event_team_role enum
ALTER TYPE public.event_team_role ADD VALUE IF NOT EXISTS 'mentor';