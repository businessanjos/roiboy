WITH targets AS (
  SELECT id, config FROM insights_visuals
  WHERE id IN ('a0c9bba3-6c4e-444b-9559-dfb72e225273','d8d0ecf8-2e94-4ffe-91b0-8e8065643fb8')
), rebuilt AS (
  SELECT t.id,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(t.config, '{filters}', (
              SELECT jsonb_agg(
                CASE WHEN f->>'field' = '3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a'
                  THEN f
                       || jsonb_build_object('field','16ebda9f-cd3b-412c-bb06-0950001963c5')
                       || jsonb_build_object('source','deal_custom')
                       || jsonb_build_object('label','Canal de Venda')
                       || jsonb_build_object('values', jsonb_build_array('Orgânico','Tráfego Pago','Indicação','Prospecção Ativa','Trafego Alheio','Carteira / Esteira','Social Seller','Recorrência'))
                  ELSE f END ORDER BY ord)
              FROM jsonb_array_elements(t.config->'filters') WITH ORDINALITY AS x(f, ord)
            )),
            '{leadFieldFilters}', '[]'::jsonb),
          '{dealFieldFilters}', '[]'::jsonb),
        '{segmentBy}', jsonb_build_object('field','16ebda9f-cd3b-412c-bb06-0950001963c5','label','Canal de Venda','source','deal_custom')),
      '{stackByCustomField}', jsonb_build_object('fieldId','16ebda9f-cd3b-412c-bb06-0950001963c5','fieldName','Canal de Venda','source','deal')
    ) AS config
  FROM targets t
)
UPDATE insights_visuals v SET config = r.config FROM rebuilt r WHERE v.id = r.id;