-- Renumera cláusulas 15ª..26ª para 14ª..25ª (faltava a 14ª) em templates e snapshots
DO $$
DECLARE
  num_pairs text[][] := ARRAY[
    ['26ª','25ª'],['25ª','24ª'],['24ª','23ª'],['23ª','22ª'],
    ['22ª','21ª'],['21ª','20ª'],['20ª','19ª'],['19ª','18ª'],
    ['18ª','17ª'],['17ª','16ª'],['16ª','15ª'],['15ª','14ª']
  ];
  ord_pairs text[][] := ARRAY[
    ['Vigésima Sexta','Vigésima Quinta'],
    ['Vigésima Quinta','Vigésima Quarta'],
    ['Vigésima Quarta','Vigésima Terceira'],
    ['Vigésima Terceira','Vigésima Segunda'],
    ['Vigésima Segunda','Vigésima Primeira'],
    ['Vigésima Primeira','Vigésima'],
    ['Cláusula Vigésima<','Cláusula Décima Nona<'],
    ['Cláusula Vigésima ','Cláusula Décima Nona '],
    ['Décima Nona','Décima Oitava'],
    ['Décima Oitava','Décima Sétima'],
    ['Décima Sétima','Décima Sexta']
  ];
  p text[];
BEGIN
  FOREACH p SLICE 1 IN ARRAY num_pairs LOOP
    UPDATE public.contract_templates
      SET content_html = replace(content_html, 'Cláusula ' || p[1], 'Cláusula ' || p[2]),
          updated_at = now();
    UPDATE public.digital_contracts
      SET template_html = replace(template_html, 'Cláusula ' || p[1], 'Cláusula ' || p[2]),
          updated_at = now()
      WHERE template_html LIKE '%Cláusula ' || p[1] || '%';
  END LOOP;

  FOREACH p SLICE 1 IN ARRAY ord_pairs LOOP
    UPDATE public.contract_templates
      SET content_html = replace(content_html, p[1], p[2]),
          updated_at = now();
    UPDATE public.digital_contracts
      SET template_html = replace(template_html, p[1], p[2]),
          updated_at = now()
      WHERE template_html LIKE '%' || p[1] || '%';
  END LOOP;
END $$;