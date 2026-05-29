UPDATE contract_templates
SET content_html = replace(
  content_html,
  'Avenida Copacabana, 325, Sala 207 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001',
  'Avenida Copacabana, 325, Conjunto 102, Sala C &mdash; Cond. Montreal Plaza, Pavmto 1, Setor 1 &mdash; Dezoito do Forte Empresarial/Alphaville &mdash; Barueri/SP &mdash; CEP 06.472-001'
),
updated_at = now()
WHERE content_html LIKE '%Avenida Copacabana, 325, Sala 207%';