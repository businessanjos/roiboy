-- Tornar todos os campos personalizados obrigatórios apenas no Ganho (e Perdido onde aplicável)
-- Removendo "all" e IDs de etapas intermediárias

UPDATE public.custom_fields SET required_stages = '["won"]'::jsonb, updated_at = now()
WHERE id = '521b553f-071d-418d-ae1c-1382356d7d9a'; -- Telefone principal

UPDATE public.custom_fields SET required_stages = '["won"]'::jsonb, updated_at = now()
WHERE id = '5accffbd-3d87-4735-b890-bc6c361694b7'; -- Cidade

UPDATE public.custom_fields SET required_stages = '["won", "lost"]'::jsonb, updated_at = now()
WHERE id = '166fe351-b29b-4f08-b330-88f82c65f625'; -- Data do primeiro contato

UPDATE public.custom_fields SET required_stages = '["won", "lost"]'::jsonb, updated_at = now()
WHERE id = '448404cd-0344-4892-a574-2387b1c17578'; -- MQL

UPDATE public.custom_fields SET required_stages = '["won", "lost"]'::jsonb, updated_at = now()
WHERE id = '16ebda9f-cd3b-412c-bb06-0950001963c5'; -- Canal de Venda

UPDATE public.custom_fields SET required_stages = '["won", "lost"]'::jsonb, updated_at = now()
WHERE id = '033b91fb-3add-4c96-aec9-567fefbd0fb2'; -- Item da Venda

UPDATE public.custom_fields SET required_stages = '["won", "lost"]'::jsonb, updated_at = now()
WHERE id = '43d7d9a1-9370-45f3-803a-93717d2a6d1d'; -- Origem da Venda

UPDATE public.custom_fields SET required_stages = '["won"]'::jsonb, updated_at = now()
WHERE id = '47df969b-735e-414f-a25e-2a56e589551d'; -- Instagram

UPDATE public.custom_fields SET required_stages = '["won"]'::jsonb, updated_at = now()
WHERE id = '55c8a887-89c9-4919-b920-630c904bf82f'; -- Gravação da Sessão