
ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS payment_groups jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.client_contracts.payment_groups IS
  'Grupos de pagamento estruturados (tranches) do contrato. Array de objetos: { id, label, method, amount, count, first_due_date, status } onde status = confirmed | pending. Grupos pending representam valores da venda ainda a definir/em aberto e não geram parcelas no financeiro. Fonte de verdade para relatórios de composição de pagamento.';

CREATE INDEX IF NOT EXISTS idx_client_contracts_payment_groups
  ON public.client_contracts USING gin (payment_groups);
