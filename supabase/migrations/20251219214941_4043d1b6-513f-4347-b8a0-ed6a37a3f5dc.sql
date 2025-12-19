-- Add onboarding tracking to account_settings
ALTER TABLE public.account_settings 
ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false,
ADD COLUMN onboarding_completed_at timestamp with time zone,
ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0;