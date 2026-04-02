
-- Create company_goals table for annual goals with monthly breakdown
CREATE TABLE public.company_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  annual_goal NUMERIC NOT NULL DEFAULT 0,
  monthly_goals JSONB NOT NULL DEFAULT '{}',
  goal_type TEXT NOT NULL DEFAULT 'revenue',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (account_id, year, goal_type)
);

-- Enable RLS
ALTER TABLE public.company_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company goals in their account"
  ON public.company_goals FOR SELECT TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can insert company goals in their account"
  ON public.company_goals FOR INSERT TO authenticated
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can update company goals in their account"
  ON public.company_goals FOR UPDATE TO authenticated
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can delete company goals in their account"
  ON public.company_goals FOR DELETE TO authenticated
  USING (account_id = public.get_current_user_account_id());

-- Trigger for updated_at
CREATE TRIGGER update_company_goals_updated_at
  BEFORE UPDATE ON public.company_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_company_goals_account_year ON public.company_goals(account_id, year);
