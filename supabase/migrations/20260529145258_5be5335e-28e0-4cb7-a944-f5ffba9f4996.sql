
-- Aumenta margem entre intro ("BARUERI · DATA") e o grid de assinaturas
-- e adiciona área reservada acima de cada linha p/ carimbo da ZapSign.

UPDATE public.contract_templates
SET content_html = replace(
      replace(
        content_html,
        '.rk-sign-intro{font-family:''Geist'',''Inter'',sans-serif;font-size:12pt;font-style:italic;color:var(--ink-2);text-align:center;margin-bottom:48px;}',
        '.rk-sign-intro{font-family:''Geist'',''Inter'',sans-serif;font-size:12pt;font-style:italic;color:var(--ink-2);text-align:center;margin-bottom:140px;}'
      ),
      '.rk-sign{text-align:center;}',
      '.rk-sign{text-align:center;padding-top:80px;}'
    ),
    updated_at = now()
WHERE content_html LIKE '%.rk-sign-intro%';

UPDATE public.digital_contracts
SET template_html = replace(
      replace(
        template_html,
        '.rk-sign-intro{font-family:''Geist'',''Inter'',sans-serif;font-size:12pt;font-style:italic;color:var(--ink-2);text-align:center;margin-bottom:48px;}',
        '.rk-sign-intro{font-family:''Geist'',''Inter'',sans-serif;font-size:12pt;font-style:italic;color:var(--ink-2);text-align:center;margin-bottom:140px;}'
      ),
      '.rk-sign{text-align:center;}',
      '.rk-sign{text-align:center;padding-top:80px;}'
    ),
    updated_at = now()
WHERE template_html LIKE '%.rk-sign-intro%';
