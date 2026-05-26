---
name: Champion Call System
description: Calls campeãs — extração ICP via IA, script ideal evolutivo, ranking amplo
type: feature
---

# Sistema de Calls Campeãs (Roy Scripts de Vendas)

## ICP extraído por IA
- A edge function `analyze-sales-call` faz DOIS passes:
  1. Análise textual (markdown) — campo `analysis`.
  2. Extração estruturada de sinais ICP via tool calling → grava em `sales_call_analyses.icp_signals` (jsonb).
- Campos extraídos: `profession`, `specialty`, `niche_combined` (ex: "Médico que atua com emagrecimento"), `business_model`, `team_size`, `revenue_range`, `ticket_range`, `decision_role`, `main_pains[]`, `main_objections[]`, `triggers_that_worked[]`, `city`, `state`, `age_estimate`.
- `ICPDashboard` agrega de `icp_signals` (NÃO mais de `clients.business_segment/niche`, que estão vazios). Mostra cobertura ICP (% de campeãs com sinais).
- Calls antigas precisam ser reanalisadas para aparecerem no ICP (banner amarelo avisa quando cobertura < 60%).

## Script Ideal (evolutivo)
- Edge function dedicada: `generate-ideal-script` (NÃO usa `analyze-sales-call`, que retorna estrutura de análise).
- Recebe: `product_name`, `product_description`, `custom_instructions`, `previous_script`, `champion_calls[]`.
- Se já existir um `sales_scripts` com título `Script Ideal — <produto>`, passa como `previous_script` para EVOLUIR em vez de regerar do zero.
- Output: playbook acionável com frases LITERAIS dos campeões (não resumo, não análise).
- Modelo: `google/gemini-2.5-pro`, 6000 tokens.

## CloserRanking — filtro ampliado
- Inclui usuários com qualquer role que case `closer|head|comercial|sdr|vendas|mentor` OU qualquer um que tenha análises registradas.
- Atribuição preferencial: `seller_user_id` (quem fez a call) > `user_id` (quem subiu).
- Antes filtrava só por "closer" no nome, escondendo gestores como Jonathan ("Comercial · Head · Sênior").
