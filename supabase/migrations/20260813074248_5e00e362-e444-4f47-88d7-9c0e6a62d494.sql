WITH target_visuals AS (
  SELECT id, config
  FROM public.insights_visuals
  WHERE dashboard_id = '29104b57-a5bf-41aa-b28a-2bd42a525206'
    AND title IN (
      'TOTAL LEADS',
      'LEADS MQL - SIM',
      'LEADS MQL - Por Canal',
      'LEADS NÃO MQL',
      'LEADS NÃO MQL - Por Canal',
      'LEADS SEM QUALIFICAÇÃO AINDA',
      'LEADS SEM QUALIFICAÇÃO - Por Canal'
    )
), normalized AS (
  SELECT
    id,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            config,
            '{filters}',
            COALESCE((
              SELECT jsonb_agg(
                CASE
                  WHEN f->>'field' = '3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a'
                    OR (f->>'label' = 'Canal' AND f->>'source' = 'lead_custom')
                  THEN jsonb_build_object(
                    'id', COALESCE(f->>'id', 'channel-filter'),
                    'field', '16ebda9f-cd3b-412c-bb06-0950001963c5',
                    'label', 'Canal de Venda',
                    'operator', COALESCE(f->>'operator', 'is_any'),
                    'source', 'deal_custom',
                    'type', COALESCE(f->>'type', 'text'),
                    'values', '["Orgânico","Tráfego Pago","Indicação","Prospecção Ativa","Trafego Alheio","Carteira / Esteira","Social Seller","Recorrência"]'::jsonb
                  )
                  WHEN f->>'field' = 'responsible_name'
                  THEN jsonb_set(
                    f,
                    '{values}',
                    '["Darlan Ferreira","Everton Pieri","George Oliveira","Jonathan Marcato","Kleberson Alves","Maikol Parnow","Rafaela Slongo","Vanessa Minelli"]'::jsonb,
                    true
                  )
                  ELSE f
                END
                ORDER BY ord
              )
              FROM jsonb_array_elements(COALESCE(config->'filters', '[]'::jsonb)) WITH ORDINALITY AS x(f, ord)
            ), '[]'::jsonb),
            true
          ),
          '{leadFieldFilters}',
          COALESCE((
            SELECT jsonb_agg(lf ORDER BY ord)
            FROM jsonb_array_elements(COALESCE(config->'leadFieldFilters', '[]'::jsonb)) WITH ORDINALITY AS x(lf, ord)
            WHERE lf->>'fieldId' <> '3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a'
          ), '[]'::jsonb),
          true
        ),
        '{dealFieldFilters}',
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(config->'dealFieldFilters', '[]'::jsonb)) AS df
            WHERE df->>'fieldId' = '16ebda9f-cd3b-412c-bb06-0950001963c5'
          ) THEN config->'dealFieldFilters'
          ELSE COALESCE(config->'dealFieldFilters', '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'fieldId', '16ebda9f-cd3b-412c-bb06-0950001963c5',
              'fieldName', 'Canal de Venda',
              'selectedValues', '["Orgânico","Tráfego Pago","Indicação","Prospecção Ativa","Trafego Alheio","Carteira / Esteira","Social Seller","Recorrência"]'::jsonb
            )
          )
        END,
        true
      ),
      '{segmentBy}',
      CASE
        WHEN config->'segmentBy'->>'field' = '3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a'
          OR (config->'segmentBy'->>'label' = 'Canal' AND config->'segmentBy'->>'source' = 'lead_custom')
        THEN '{"field":"16ebda9f-cd3b-412c-bb06-0950001963c5","label":"Canal de Venda","source":"deal_custom"}'::jsonb
        ELSE COALESCE(config->'segmentBy', 'null'::jsonb)
      END,
      true
    ) AS config
  FROM target_visuals
)
UPDATE public.insights_visuals v
SET config = n.config
FROM normalized n
WHERE v.id = n.id;