-- Add business profile fields directly on clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS initial_revenue numeric,
  ADD COLUMN IF NOT EXISTS current_revenue numeric,
  ADD COLUMN IF NOT EXISTS current_revenue_month text,
  ADD COLUMN IF NOT EXISTS differential text,
  ADD COLUMN IF NOT EXISTS method_name text;

COMMENT ON COLUMN public.clients.initial_revenue IS 'Faturamento do cliente ao entrar na mentoria (BRL).';
COMMENT ON COLUMN public.clients.current_revenue IS 'Faturamento mais recente informado (BRL). Atualizado mensalmente.';
COMMENT ON COLUMN public.clients.current_revenue_month IS 'Mês (YYYY-MM) a que se refere current_revenue.';
COMMENT ON COLUMN public.clients.differential IS 'Diferencial competitivo do cliente.';
COMMENT ON COLUMN public.clients.method_name IS 'Nome do método/produto próprio criado pelo cliente.';

-- Monthly revenue history
CREATE TABLE IF NOT EXISTS public.client_revenue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  month text NOT NULL, -- YYYY-MM
  revenue numeric NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month)
);

CREATE INDEX IF NOT EXISTS idx_client_revenue_history_client ON public.client_revenue_history(client_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_client_revenue_history_account ON public.client_revenue_history(account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_revenue_history TO authenticated;
GRANT ALL ON public.client_revenue_history TO service_role;

ALTER TABLE public.client_revenue_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revenue history in their account"
  ON public.client_revenue_history FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert revenue history in their account"
  ON public.client_revenue_history FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update revenue history in their account"
  ON public.client_revenue_history FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete revenue history in their account"
  ON public.client_revenue_history FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.client_revenue_history_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_revenue_history_touch ON public.client_revenue_history;
CREATE TRIGGER trg_client_revenue_history_touch
  BEFORE UPDATE ON public.client_revenue_history
  FOR EACH ROW EXECUTE FUNCTION public.client_revenue_history_touch();

-- Auto-snapshot: when clients.current_revenue changes, upsert into history for the current (or informed) month
CREATE OR REPLACE FUNCTION public.snapshot_client_current_revenue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month text;
  v_user uuid;
BEGIN
  IF NEW.current_revenue IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.current_revenue IS NOT DISTINCT FROM OLD.current_revenue
     AND NEW.current_revenue_month IS NOT DISTINCT FROM OLD.current_revenue_month THEN
    RETURN NEW;
  END IF;

  v_month := COALESCE(NEW.current_revenue_month, to_char(now(), 'YYYY-MM'));
  NEW.current_revenue_month := v_month;

  SELECT id INTO v_user FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

  INSERT INTO public.client_revenue_history (client_id, account_id, month, revenue, created_by)
  VALUES (NEW.id, NEW.account_id, v_month, NEW.current_revenue, v_user)
  ON CONFLICT (client_id, month)
  DO UPDATE SET revenue = EXCLUDED.revenue, updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_client_current_revenue ON public.clients;
CREATE TRIGGER trg_snapshot_client_current_revenue
  BEFORE INSERT OR UPDATE OF current_revenue, current_revenue_month ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_client_current_revenue();