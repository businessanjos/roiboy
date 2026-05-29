UPDATE public.contract_templates
SET content_html = REPLACE(
  REPLACE(
    content_html,
    '.rk-clause{display:grid;grid-template-columns:140px 1fr;gap:18px;padding:14px 0;border-bottom:1px solid var(--line);}',
    '.rk-clause{display:grid;grid-template-columns:180px 1fr;gap:18px;padding:14px 0;border-bottom:1px solid var(--line);}'
  ),
  '.rk-clause-num{font-family:''Geist'',''Inter'',sans-serif;font-size:10pt;font-style:italic;font-weight:600;color:var(--ink);padding-top:2px;text-transform:uppercase;letter-spacing:.06em;}',
  '.rk-clause-num{font-family:''Geist'',''Inter'',sans-serif;font-size:10pt;font-style:italic;font-weight:600;color:var(--ink);padding-top:2px;text-transform:uppercase;letter-spacing:.06em;word-wrap:break-word;overflow-wrap:break-word;hyphens:auto;line-height:1.35;}'
)
WHERE content_html LIKE '%rk-clause{display:grid;grid-template-columns:140px%';

UPDATE public.digital_contracts
SET template_html = REPLACE(
  REPLACE(
    template_html,
    '.rk-clause{display:grid;grid-template-columns:140px 1fr;gap:18px;padding:14px 0;border-bottom:1px solid var(--line);}',
    '.rk-clause{display:grid;grid-template-columns:180px 1fr;gap:18px;padding:14px 0;border-bottom:1px solid var(--line);}'
  ),
  '.rk-clause-num{font-family:''Geist'',''Inter'',sans-serif;font-size:10pt;font-style:italic;font-weight:600;color:var(--ink);padding-top:2px;text-transform:uppercase;letter-spacing:.06em;}',
  '.rk-clause-num{font-family:''Geist'',''Inter'',sans-serif;font-size:10pt;font-style:italic;font-weight:600;color:var(--ink);padding-top:2px;text-transform:uppercase;letter-spacing:.06em;word-wrap:break-word;overflow-wrap:break-word;hyphens:auto;line-height:1.35;}'
)
WHERE template_html LIKE '%rk-clause{display:grid;grid-template-columns:140px%';