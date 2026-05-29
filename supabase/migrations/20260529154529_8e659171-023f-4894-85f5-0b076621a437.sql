UPDATE public.contract_templates
SET content_html = REPLACE(content_html, 'Nome &middot; CPF', 'Nome')
WHERE content_html LIKE '%Nome &middot; CPF%';

UPDATE public.digital_contracts
SET template_html = REPLACE(template_html, 'Nome &middot; CPF', 'Nome')
WHERE template_html LIKE '%Nome &middot; CPF%';