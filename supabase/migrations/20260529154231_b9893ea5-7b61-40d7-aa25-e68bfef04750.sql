-- Insere um bloco de proteção (safety net) logo após a regra global box-sizing
-- Cobre: word-wrap, hyphens, min-width:0 em grids, colunas previsíveis nos dl

UPDATE public.contract_templates
SET content_html = REPLACE(
  content_html,
  '.contract-document *{box-sizing:border-box;}',
  '.contract-document *{box-sizing:border-box;}'
  || '.contract-document, .contract-document *{overflow-wrap:break-word;word-wrap:break-word;}'
  || '.contract-document h1, .contract-document h2, .contract-document h3{hyphens:auto;-webkit-hyphens:auto;}'
  || '.rk-clause, .rk-cover-meta, .rk-cover-meta .item, .rk-party, .rk-party dd, .rk-postal dd, .rk-hero, .rk-hero-grid, .rk-hero-grid > div, .rk-pillar, .rk-notice .body, .rk-sign, .rk-toc ol li{min-width:0;}'
  || '.rk-party dl{grid-template-columns:110px 1fr;}'
  || '.rk-postal dl{grid-template-columns:120px 1fr;}'
  || '.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}'
)
WHERE content_html LIKE '%.contract-document *{box-sizing:border-box;}%'
  AND content_html NOT LIKE '%/* safety-net-applied */%';

-- Marca como aplicado (comentário invisível)
UPDATE public.contract_templates
SET content_html = REPLACE(
  content_html,
  '.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}',
  '.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}/* safety-net-applied */'
)
WHERE content_html LIKE '%.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}%'
  AND content_html NOT LIKE '%/* safety-net-applied */%';

-- Mesmo tratamento nos contratos já gerados
UPDATE public.digital_contracts
SET template_html = REPLACE(
  template_html,
  '.contract-document *{box-sizing:border-box;}',
  '.contract-document *{box-sizing:border-box;}'
  || '.contract-document, .contract-document *{overflow-wrap:break-word;word-wrap:break-word;}'
  || '.contract-document h1, .contract-document h2, .contract-document h3{hyphens:auto;-webkit-hyphens:auto;}'
  || '.rk-clause, .rk-cover-meta, .rk-cover-meta .item, .rk-party, .rk-party dd, .rk-postal dd, .rk-hero, .rk-hero-grid, .rk-hero-grid > div, .rk-pillar, .rk-notice .body, .rk-sign, .rk-toc ol li{min-width:0;}'
  || '.rk-party dl{grid-template-columns:110px 1fr;}'
  || '.rk-postal dl{grid-template-columns:120px 1fr;}'
  || '.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}'
)
WHERE template_html LIKE '%.contract-document *{box-sizing:border-box;}%'
  AND template_html NOT LIKE '%/* safety-net-applied */%';

UPDATE public.digital_contracts
SET template_html = REPLACE(
  template_html,
  '.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}',
  '.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}/* safety-net-applied */'
)
WHERE template_html LIKE '%.rk-party dd, .rk-postal dd, .rk-cover-meta .item .v, .rk-sign .name, .rk-sign .doc{word-break:break-word;}%'
  AND template_html NOT LIKE '%/* safety-net-applied */%';