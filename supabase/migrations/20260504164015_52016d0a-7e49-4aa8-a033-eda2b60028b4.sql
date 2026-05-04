
CREATE TABLE IF NOT EXISTS public.consultant_bonus_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES public.consultant_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  actual_value numeric NOT NULL DEFAULT 0,
  achieved boolean NOT NULL DEFAULT false,
  bonus_paid numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_consultant_payouts_user_period
  ON public.consultant_bonus_payouts (user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_consultant_payouts_account_period
  ON public.consultant_bonus_payouts (account_id, year, month);

ALTER TABLE public.consultant_bonus_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payouts in their account"
  ON public.consultant_bonus_payouts FOR SELECT
  TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can manage payouts in their account"
  ON public.consultant_bonus_payouts FOR ALL
  TO authenticated
  USING (account_id = public.get_current_user_account_id())
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_consultant_payouts_updated_at
  BEFORE UPDATE ON public.consultant_bonus_payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
