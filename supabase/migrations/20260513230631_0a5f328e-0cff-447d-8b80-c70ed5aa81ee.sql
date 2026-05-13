
CREATE TABLE public.spiff_spin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  spiff_id uuid NOT NULL REFERENCES public.sales_spiffs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  requested_by uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','consumed','cancelled')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  spin_id uuid REFERENCES public.spiff_spins(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_spiff_spin_requests_account_status ON public.spiff_spin_requests(account_id, status);
CREATE INDEX idx_spiff_spin_requests_user ON public.spiff_spin_requests(user_id);

ALTER TABLE public.spiff_spin_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view requests in account"
ON public.spiff_spin_requests FOR SELECT
USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

CREATE POLICY "create requests in account"
ON public.spiff_spin_requests FOR INSERT
WITH CHECK (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

-- Approve/reject: only managers or the requester (cancel)
CREATE POLICY "update requests in account"
ON public.spiff_spin_requests FOR UPDATE
USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()))
WITH CHECK (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

CREATE POLICY "delete requests in account"
ON public.spiff_spin_requests FOR DELETE
USING (account_id IN (SELECT users.account_id FROM users WHERE users.auth_user_id = auth.uid()));

CREATE TRIGGER update_spiff_spin_requests_updated_at
BEFORE UPDATE ON public.spiff_spin_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.spiff_spin_requests;
ALTER TABLE public.spiff_spin_requests REPLICA IDENTITY FULL;
