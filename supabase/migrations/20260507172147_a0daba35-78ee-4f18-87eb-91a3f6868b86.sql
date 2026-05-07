
-- Approval workflow + audit log for commission deal entries

ALTER TABLE public.commission_deal_entries
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_requested_reason text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.commission_deal_entries
  DROP CONSTRAINT IF EXISTS commission_deal_entries_approval_status_chk;
ALTER TABLE public.commission_deal_entries
  ADD CONSTRAINT commission_deal_entries_approval_status_chk
  CHECK (approval_status IN ('not_requested','pending_approval','approved','rejected'));

-- Audit / history table
CREATE TABLE IF NOT EXISTS public.commission_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  entry_id uuid NOT NULL REFERENCES public.commission_deal_entries(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('requested','approved','rejected','marked_paid','reverted','note')),
  performed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  performed_by_name text,
  reason text,
  previous_status text,
  new_status text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_approval_history_entry
  ON public.commission_approval_history(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_approval_history_account
  ON public.commission_approval_history(account_id, created_at DESC);

ALTER TABLE public.commission_approval_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View commission approval history" ON public.commission_approval_history;
CREATE POLICY "View commission approval history"
  ON public.commission_approval_history FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

DROP POLICY IF EXISTS "Insert commission approval history" ON public.commission_approval_history;
CREATE POLICY "Insert commission approval history"
  ON public.commission_approval_history FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());
