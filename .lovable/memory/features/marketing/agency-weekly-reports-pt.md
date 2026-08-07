---
name: Relatórios semanais de agência
description: Aba "Relatórios semanais" em Marketing > Agências > detalhe, com tabela agency_weekly_reports e métricas derivadas calculadas automaticamente
type: feature
---
- Tabela `public.agency_weekly_reports` (única por `agency_id` + `week_start`), RLS por `account_id`.
- Campos R$: spend, cpl, cost_per_mql, cpm, best_creative_spend, best_creative_cpa.
- Absolutos: impressions, link_clicks, page_views, leads_total, leads_mql, best_creative_mqls.
- % (0-100): ctr, connect_rate, mql_rate, lp_conversion_rate.
- Textos: comparison_notes, evolution_notes, bottleneck_notes, team_actions, client_dependencies, summary, best_creative_name/url/notes.
- UI: `AgencyWeeklyReportsTab.tsx` + `AgencyWeeklyReportDialog.tsx`. O usuário digita só os absolutos; as taxas/custos são calculados (CTR, Connect Rate, Taxa de MQL, LP→Lead, CPL, CPM, CPA) com toggle auto/manual por campo.
- Semana padrão do formulário: semana anterior (domingo a sábado).

## Link público da agência
- `traffic_agencies.public_report_token` gera o link oficial `https://iamroy.app/relatorio-agencia/{token}` (botão "Copiar link da agência" na aba Relatórios semanais).
- Página `src/pages/public/PublicAgencyWeeklyReport.tsx` + edge function `agency-report-portal` (verify_jwt=false, service role, upsert por agency_id+week_start).
- Envios pelo link marcam `submitted_via_public_link` e `submitted_by_name`.
