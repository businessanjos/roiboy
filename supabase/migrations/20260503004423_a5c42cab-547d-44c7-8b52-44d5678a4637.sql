UPDATE public.contract_templates
SET content_html = regexp_replace(
  content_html,
  E'\\.rk-pillars\\{[^}]*\\}\\s*\\.rk-pillar\\{[^}]*\\}\\s*\\.rk-pillar:last-child\\{[^}]*\\}\\s*\\.rk-pillar \\.num\\{[^}]*\\}\\s*\\.rk-pillar \\.name\\{[^}]*\\}\\s*\\.rk-pillar \\.desc\\{[^}]*\\}',
  '.rk-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:28px 0;background:#fff;border:1px solid var(--ink);border-radius:2px;overflow:hidden;}'
  '.rk-pillar{position:relative;padding:28px 26px 30px;border-right:1px solid var(--line);background:#fff;display:flex;flex-direction:column;}'
  '.rk-pillar:last-child{border-right:none;}'
  '.rk-pillar::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--ink);}'
  '.rk-pillar .num{font-family:''Geist'',''Inter'',sans-serif;font-size:30pt;font-weight:800;color:var(--ink);line-height:1;letter-spacing:-.03em;margin-bottom:18px;}'
  '.rk-pillar .name{font-size:8.5pt;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--ink);margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--line);}'
  '.rk-pillar .desc{font-size:9.5pt;color:var(--muted);line-height:1.65;text-align:left;hyphens:auto;}'
)
WHERE id = '23a8cada-3181-4b92-bdf2-194e04083c39';