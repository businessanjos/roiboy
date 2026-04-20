-- Cria o campo "Detalhamento de Pagamento" para a conta que tem o campo "Forma da Pagamento"
INSERT INTO public.custom_fields (
  account_id,
  name,
  field_type,
  options,
  is_required,
  required_stages,
  show_in_deals,
  show_in_clients,
  show_in_leads,
  display_order
)
SELECT
  account_id,
  'Detalhamento de Pagamento',
  'text',
  '[]'::jsonb,
  true,
  '["won"]'::jsonb,
  true,
  false,
  false,
  COALESCE((SELECT MAX(display_order) FROM public.custom_fields WHERE account_id = cf.account_id), 0) + 1
FROM public.custom_fields cf
WHERE cf.id = 'b2cd2366-b990-43d9-a0b7-1b567fbed729'
AND NOT EXISTS (
  SELECT 1 FROM public.custom_fields cf2
  WHERE cf2.account_id = cf.account_id
  AND cf2.name = 'Detalhamento de Pagamento'
);