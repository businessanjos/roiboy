ALTER TABLE public.content_approval_checklists
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_blocker_notified_at timestamptz;