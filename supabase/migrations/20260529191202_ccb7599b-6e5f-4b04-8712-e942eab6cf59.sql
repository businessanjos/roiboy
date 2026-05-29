UPDATE public.contract_templates
SET content_html = REPLACE(content_html, 'Especializados', E'\nEspecializados')
WHERE content_html LIKE '%Especializados%';