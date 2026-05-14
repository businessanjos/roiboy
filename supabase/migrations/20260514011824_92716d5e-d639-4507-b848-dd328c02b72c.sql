
CREATE TABLE IF NOT EXISTS public.client_ryka_provisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  whatsapp_status text,
  whatsapp_error text,
  ryka_response jsonb,
  triggered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ryka_prov_client ON public.client_ryka_provisions(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ryka_prov_account ON public.client_ryka_provisions(account_id, created_at DESC);

ALTER TABLE public.client_ryka_provisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ryka_prov_select_same_account"
ON public.client_ryka_provisions FOR SELECT
TO authenticated
USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "ryka_prov_insert_same_account"
ON public.client_ryka_provisions FOR INSERT
TO authenticated
WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_ryka_prov_updated_at
BEFORE UPDATE ON public.client_ryka_provisions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
