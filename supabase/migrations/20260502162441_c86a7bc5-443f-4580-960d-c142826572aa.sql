UPDATE contract_templates
SET content_html = REPLACE(content_html, 'Anno MMXXVI', '{{CONTRACT_YEAR}}')
WHERE content_html LIKE '%Anno MMXXVI%';