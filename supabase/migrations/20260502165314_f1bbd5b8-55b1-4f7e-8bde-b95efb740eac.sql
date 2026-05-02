CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  name TEXT NOT NULL,
  contract_label TEXT NOT NULL,
  has_entrada BOOLEAN NOT NULL DEFAULT false,
  has_parcelas BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Account members can view payment methods"
  ON public.payment_methods FOR SELECT
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Account members can insert payment methods"
  ON public.payment_methods FOR INSERT
  WITH CHECK (account_id = public.get_current_user_account_id());

CREATE POLICY "Account members can update payment methods"
  ON public.payment_methods FOR UPDATE
  USING (account_id = public.get_current_user_account_id());

CREATE POLICY "Account members can delete payment methods"
  ON public.payment_methods FOR DELETE
  USING (account_id = public.get_current_user_account_id());

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_methods_account ON public.payment_methods(account_id, is_active, display_order);

-- Seed default payment methods for existing accounts
INSERT INTO public.payment_methods (account_id, name, contract_label, has_entrada, has_parcelas, display_order)
SELECT a.id, m.name, m.contract_label, m.has_entrada, m.has_parcelas, m.display_order
FROM public.accounts a
CROSS JOIN (VALUES
  ('PIX à vista', 'PIX à vista', false, false, 1),
  ('Boleto à vista', 'Boleto à vista', false, false, 2),
  ('Cartão de crédito (parcelado)', 'Cartão de crédito parcelado', false, true, 3),
  ('Entrada PIX + Cartão de crédito', 'Entrada via PIX + parcelas no cartão de crédito', true, true, 4),
  ('Entrada PIX + Boleto parcelado', 'Entrada via PIX + boletos parcelados', true, true, 5),
  ('Boleto parcelado', 'Boleto parcelado', false, true, 6),
  ('Transferência bancária', 'Transferência bancária', false, false, 7)
) AS m(name, contract_label, has_entrada, has_parcelas, display_order);