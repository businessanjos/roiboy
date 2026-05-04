---
name: consultant-bonus-area
description: Área "Premiação & Bônus" no setor Operações para metas de bonificação das consultoras (renovação, churn, NPS) por consultora/produto/ano com breakdown mensal e gatilho em R$
type: feature
---
- Rota: `/operations/consultant-bonus`. Item adicionado em `sectors.ts` no setor Operações com ícone Trophy.
- Visibilidade restrita no `Sidebar.tsx` apenas para usuários cujo nome/email contém: maikol, jonathan, everton, bruna. A própria página também faz `<Navigate>` se outro usuário acessar via URL.
- Consultoras consideradas (filtradas por nome): Andréia, Dayara, Michele, Ana.
- Tabela `consultant_goals`: account_id, user_id (consultora), product_id, year, metric_type ('renewal_rate'|'churn_rate'|'nps'), annual_target, monthly_targets jsonb (chaves "0".."11"), bonus_amount (R$ por gatilho), notes. Unique em (account_id, user_id, product_id, year, metric_type). RLS por `get_current_user_account_id()`.
- Hook `useConsultantGoals(year)` faz upsert/delete e expõe METRIC_LABELS / MONTH_LABELS.
- Vínculo cliente↔consultora: deve usar `clients.responsible_user_id` quando for calcular performance real (cálculos de atingimento ainda não implementados — apenas configuração de metas).
