
CREATE TABLE public.ec_mentoring_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, session_date)
);

CREATE INDEX idx_ec_mentoring_client ON public.ec_mentoring_attendance(client_id, session_date DESC);
CREATE INDEX idx_ec_mentoring_account ON public.ec_mentoring_attendance(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ec_mentoring_attendance TO authenticated;
GRANT ALL ON public.ec_mentoring_attendance TO service_role;

ALTER TABLE public.ec_mentoring_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view EC mentoring in their account"
  ON public.ec_mentoring_attendance FOR SELECT
  TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE POLICY "Users can insert EC mentoring in their account"
  ON public.ec_mentoring_attendance FOR INSERT
  TO authenticated
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can update EC mentoring in their account"
  ON public.ec_mentoring_attendance FOR UPDATE
  TO authenticated
  USING (account_id = public.get_user_account_id())
  WITH CHECK (account_id = public.get_user_account_id());

CREATE POLICY "Users can delete EC mentoring in their account"
  ON public.ec_mentoring_attendance FOR DELETE
  TO authenticated
  USING (account_id = public.get_user_account_id());

CREATE TRIGGER update_ec_mentoring_attendance_updated_at
  BEFORE UPDATE ON public.ec_mentoring_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
