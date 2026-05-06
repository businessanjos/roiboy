-- Add native received_value column to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS received_value NUMERIC(14,2);

-- Backfill from existing "Valor Recebido da Venda" custom field
UPDATE public.deals d
SET received_value = dfv.value_number
FROM public.deal_field_values dfv
WHERE dfv.deal_id = d.id
  AND dfv.field_id = '924c04a5-9824-443b-8122-8fc8c2ad727e'
  AND dfv.value_number IS NOT NULL
  AND d.received_value IS NULL;

CREATE INDEX IF NOT EXISTS idx_deals_received_value ON public.deals (account_id, received_value) WHERE received_value IS NOT NULL;