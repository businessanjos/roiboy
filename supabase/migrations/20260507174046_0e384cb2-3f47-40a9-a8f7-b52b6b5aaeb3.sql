CREATE TABLE public.consultant_weekly_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  user_id UUID NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  item_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT true,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id, week_start, item_key)
);

CREATE INDEX idx_cwc_user_week ON public.consultant_weekly_checklist(user_id, week_start);
CREATE INDEX idx_cwc_client_week ON public.consultant_weekly_checklist(client_id, week_start);
CREATE INDEX idx_cwc_account ON public.consultant_weekly_checklist(account_id);

ALTER TABLE public.consultant_weekly_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checklist in their account"
ON public.consultant_weekly_checklist FOR SELECT
USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can insert their own checklist"
ON public.consultant_weekly_checklist FOR INSERT
WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can update checklist in their account"
ON public.consultant_weekly_checklist FOR UPDATE
USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Users can delete checklist in their account"
ON public.consultant_weekly_checklist FOR DELETE
USING (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_cwc_updated_at
BEFORE UPDATE ON public.consultant_weekly_checklist
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();