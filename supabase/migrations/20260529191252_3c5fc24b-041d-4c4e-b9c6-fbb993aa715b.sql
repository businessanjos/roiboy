UPDATE public.contract_templates
SET content_html = REPLACE(content_html, E'\nEspecializados', '<br/>Especializados')
WHERE content_html LIKE E'%\nEspecializados%';