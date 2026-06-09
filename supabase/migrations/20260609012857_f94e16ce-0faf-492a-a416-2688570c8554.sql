
ALTER TABLE public.hr_admissions
  ADD COLUMN IF NOT EXISTS esocial_sent_to_accountant_at timestamptz,
  ADD COLUMN IF NOT EXISTS esocial_accountant_email text,
  ADD COLUMN IF NOT EXISTS esocial_event_protocol text,
  ADD COLUMN IF NOT EXISTS esocial_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS esocial_notes text;
