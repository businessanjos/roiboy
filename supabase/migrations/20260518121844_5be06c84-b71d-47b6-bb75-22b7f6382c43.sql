
-- Token público para portal do prestador
ALTER TABLE public.hr_service_providers
  ADD COLUMN IF NOT EXISTS portal_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS preferred_payment_day integer;

-- Garantir token para registros antigos
UPDATE public.hr_service_providers SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;

-- Tabela de notas fiscais mensais enviadas pelos prestadores
CREATE TABLE IF NOT EXISTS public.hr_provider_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.hr_service_providers(id) ON DELETE CASCADE,
  competence_month date NOT NULL, -- primeiro dia do mês de competência
  invoice_number text,
  amount numeric(14,2),
  file_url text NOT NULL,
  file_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid
  rejection_reason text,
  payment_due_date date,
  paid_at date,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_provider_invoices_provider ON public.hr_provider_invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_hr_provider_invoices_account_status ON public.hr_provider_invoices(account_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_invoice_competence ON public.hr_provider_invoices(provider_id, competence_month);

ALTER TABLE public.hr_provider_invoices ENABLE ROW LEVEL SECURITY;

-- Acesso interno: usuários da mesma conta podem ler/gerenciar (financeiro/RH)
CREATE POLICY "Account members can view provider invoices"
  ON public.hr_provider_invoices FOR SELECT
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can insert provider invoices"
  ON public.hr_provider_invoices FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can update provider invoices"
  ON public.hr_provider_invoices FOR UPDATE
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Account members can delete provider invoices"
  ON public.hr_provider_invoices FOR DELETE
  USING (account_id IN (SELECT account_id FROM public.users WHERE auth_user_id = auth.uid()));

CREATE TRIGGER trg_hr_provider_invoices_updated_at
  BEFORE UPDATE ON public.hr_provider_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket privado para NFs (acesso só via edge function ou usuários autenticados)
INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-invoices', 'provider-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Usuários autenticados da mesma conta podem ler arquivos do bucket
CREATE POLICY "Authenticated can read provider invoices files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'provider-invoices' AND auth.uid() IS NOT NULL);
