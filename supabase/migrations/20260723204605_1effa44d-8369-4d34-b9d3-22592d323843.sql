
CREATE TABLE public.ec_mentoring_client_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('novata','agendado','realizada_agendar_proxima','remarcar','nao_quer_agendar','nao_respondeu')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ec_mentoring_client_status TO authenticated;
GRANT ALL ON public.ec_mentoring_client_status TO service_role;

ALTER TABLE public.ec_mentoring_client_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view EC status"
  ON public.ec_mentoring_client_status FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert EC status"
  ON public.ec_mentoring_client_status FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can update EC status"
  ON public.ec_mentoring_client_status FOR UPDATE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can delete EC status"
  ON public.ec_mentoring_client_status FOR DELETE TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_ec_mentoring_client_status_updated_at
  BEFORE UPDATE ON public.ec_mentoring_client_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
