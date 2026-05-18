---
name: Tributário & Contador
description: Área /financial/tributario com perfil tributário por CNPJ, cadastro do contador, histórico de interações e alertas via Lovable AI (gemini-2.5-pro)
type: feature
---

Centraliza no Financeiro tudo que diz respeito a regime tributário e contador:

- Rota: `/financial/tributario` (item "Tributário" no sidebar do Financeiro, ícone `Scale`)
- 4 abas: Visão geral, Regime & Empresa, Contador, Alertas & IA
- Por CNPJ (usa `useFinancialCompany` / `omie_settings`)

Tabelas (todas com `account_id = get_my_account_id()` em RLS, política única `FOR ALL`):
- `financial_tax_profile` — 1 por `omie_settings_id`. Enums `tax_regime` (mei/simples_nacional/lucro_presumido/lucro_real) e `tax_simples_annex` (I–V)
- `financial_accountant` — 1 por `omie_settings_id`
- `financial_accountant_interactions` — N por contador (timeline simples com nota + anexo_url)
- `financial_tax_alerts` — enums `tax_alert_severity` (info/warning/critical), `tax_alert_status` (open/read/resolved/dismissed), `tax_alert_origin` (manual/ai)
- `financial_tax_ai_runs` — log de cada análise (input_summary, output, model, alerts_created)

Edge function: `financial-tax-ai-analyze` — recebe `omie_settings_id`, agrega `financial_entries` dos últimos 12 meses, chama Lovable AI (`google/gemini-2.5-pro`) com tool calling (`emit_tax_alerts`), persiste alertas e log da execução.

**Why:** o financeiro existente não tinha onde guardar regime, contador nem recomendações estruturais (classificação de produtos, pró-labore, distribuição de lucro).

**How to apply:** ao criar novos alertas estruturais sobre fiscalidade, gravar em `financial_tax_alerts` com `origem='manual'` para aparecer na mesma lista da IA.
