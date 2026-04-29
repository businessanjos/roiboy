UPDATE public.contract_templates
SET content_html = replace(content_html, 'Rykos Mentoring', 'Rykas Mentoring'),
    updated_at = now()
WHERE id = '23a8cada-3181-4b92-bdf2-194e04083c39';