ALTER TABLE public.sales_spiffs
  ADD COLUMN IF NOT EXISTS payment_tiers jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS participant_user_ids jsonb DEFAULT NULL;

COMMENT ON COLUMN public.sales_spiffs.payment_tiers IS 'Lista de faixas de bônus por forma de pagamento. Formato: [{label, bonus, min_parcelas, max_parcelas, includes_cash}]';
COMMENT ON COLUMN public.sales_spiffs.participant_user_ids IS 'Lista de user_ids participantes (NULL = todos os Closers ativos)';