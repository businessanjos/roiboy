-- Corrige o endereço da Eternum: deve ser "Sala 102", não "Sala 207" nem o bloco longo
UPDATE public.contract_templates
SET content_html = REPLACE(
  REPLACE(
    content_html,
    'Avenida Copacabana, 325, Conjunto 102, Sala C &mdash; Cond. Montreal Plaza, Pavmto 1, Setor 1 &mdash; Dezoito do Forte Empresarial/Alphaville &mdash; Barueri/SP &mdash; CEP 06.472-001',
    'Avenida Copacabana, 325, Sala 102 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001'
  ),
  'Avenida Copacabana, 325, Sala 207 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001',
  'Avenida Copacabana, 325, Sala 102 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001'
)
WHERE content_html LIKE '%Avenida Copacabana, 325%';

UPDATE public.digital_contracts
SET template_html = REPLACE(
  REPLACE(
    template_html,
    'Avenida Copacabana, 325, Conjunto 102, Sala C &mdash; Cond. Montreal Plaza, Pavmto 1, Setor 1 &mdash; Dezoito do Forte Empresarial/Alphaville &mdash; Barueri/SP &mdash; CEP 06.472-001',
    'Avenida Copacabana, 325, Sala 102 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001'
  ),
  'Avenida Copacabana, 325, Sala 207 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001',
  'Avenida Copacabana, 325, Sala 102 &mdash; Dezoito do Forte Empresarial &mdash; Barueri/SP &mdash; CEP 06.472.001'
)
WHERE template_html LIKE '%Avenida Copacabana, 325%';