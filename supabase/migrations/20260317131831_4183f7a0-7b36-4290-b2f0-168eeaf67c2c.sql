
ALTER TABLE public.team_roles 
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS seniority text;
