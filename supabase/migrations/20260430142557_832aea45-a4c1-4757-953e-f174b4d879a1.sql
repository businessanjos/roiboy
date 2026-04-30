-- Atualizar tipografia do template Rykas Mentoring para estilo Suíço Minimalista (Geist)
-- Substitui Playfair Display + Inter por Geist (sans-serif moderna estilo Vercel/Linear)

UPDATE public.contract_templates
SET 
  content_html = regexp_replace(
    regexp_replace(
      regexp_replace(
        content_html,
        -- 1. Trocar import de fontes Google
        E'@import url\\(''https://fonts.googleapis.com/css2\\?family=Playfair\\+Display[^'']+''\\);',
        E'@import url(''https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600&display=swap'');',
        'g'
      ),
      -- 2. Trocar todas as referências a Playfair Display
      E'''Playfair Display''[^;,]*',
      E'''Geist'', ''Inter'', system-ui, -apple-system, sans-serif',
      'g'
    ),
    -- 3. Trocar font-family Inter solto para Geist (corpo)
    E'font-family:\\s*''Inter''[^;]*;',
    E'font-family: ''Geist'', ''Inter'', system-ui, -apple-system, BlinkMacSystemFont, sans-serif; font-feature-settings: ''ss01'', ''cv11'';',
    'g'
  ),
  updated_at = now()
WHERE id = '23a8cada-3181-4b92-bdf2-194e04083c39';

-- Refinar letter-spacing dos títulos para o ar minimalista Geist
UPDATE public.contract_templates
SET 
  content_html = regexp_replace(
    content_html,
    E'\\.rk-title\\s*\\{[^}]*\\}',
    E'.rk-title { font-family: ''Geist'', ''Inter'', system-ui, sans-serif; font-weight: 600; font-size: 56px; line-height: 1.05; letter-spacing: -0.035em; color: #FFFFFF; margin: 0 0 24px 0; font-feature-settings: ''ss01'', ''ss02''; }',
    'g'
  ),
  updated_at = now()
WHERE id = '23a8cada-3181-4b92-bdf2-194e04083c39';