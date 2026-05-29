-- Repair clause + section numbering by splitting on the corrupted marker
-- and rebuilding with the correct sequential labels.
CREATE OR REPLACE FUNCTION pg_temp.renumber_contract(html text)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE
  marker_clause text := '<span class="rk-clause-num">Cláusula 14ª</span>';
  marker_h2     text := '<h2>Cláusula Décima Sexta</h2>';
  parts         text[];
  out_html      text;
  i             int;
  n             int;
  section_titles text[] := ARRAY[
    'Cláusula Décima Sexta',
    'Cláusula Décima Sétima',
    'Cláusula Décima Oitava',
    'Cláusula Décima Nona',
    'Cláusula Vigésima',
    'Cláusula Vigésima Primeira',
    'Cláusula Vigésima Segunda',
    'Cláusula Vigésima Terceira',
    'Cláusula Vigésima Quarta',
    'Cláusula Vigésima Quinta'
  ];
BEGIN
  out_html := html;

  -- Section IX combined header
  out_html := replace(out_html,
    '<h2>Cláusulas 15ª &amp; 16ª</h2>',
    '<h2>Cláusulas 14ª &amp; 15ª</h2>');

  -- Renumber clause-num spans: 12 occurrences → 14..25
  parts := string_to_array(out_html, marker_clause);
  n := array_length(parts, 1);
  IF n IS NOT NULL AND n >= 2 THEN
    out_html := parts[1];
    FOR i IN 2..n LOOP
      out_html := out_html
        || '<span class="rk-clause-num">Cláusula ' || (12 + i)::text || 'ª</span>'
        || parts[i];
    END LOOP;
  END IF;

  -- Renumber section h2 titles: up to 10 occurrences → Décima Sexta..Vigésima Quinta
  parts := string_to_array(out_html, marker_h2);
  n := array_length(parts, 1);
  IF n IS NOT NULL AND n >= 2 THEN
    out_html := parts[1];
    FOR i IN 2..n LOOP
      IF (i - 1) <= array_length(section_titles, 1) THEN
        out_html := out_html
          || '<h2>' || section_titles[i - 1] || '</h2>'
          || parts[i];
      ELSE
        out_html := out_html || marker_h2 || parts[i];
      END IF;
    END LOOP;
  END IF;

  RETURN out_html;
END
$f$;

UPDATE public.contract_templates
SET content_html = pg_temp.renumber_contract(content_html),
    updated_at   = now()
WHERE content_html LIKE '%<span class="rk-clause-num">Cláusula 14ª</span>%';

UPDATE public.digital_contracts
SET template_html = pg_temp.renumber_contract(template_html),
    updated_at    = now()
WHERE template_html LIKE '%<span class="rk-clause-num">Cláusula 14ª</span>%';