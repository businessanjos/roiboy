---
name: SPIFFs Tier-Themed Page
description: Page color and hero on /spiffs change with closer's monthly won-deal tier (Latão → Elite)
type: feature
---

# SPIFFs Tier-Themed Experience

A página `/spiffs` (Acompanhamento de SPIFFs) tem cor adaptativa e um **hero card** que reflete o nível atual do closer logado, baseado no número de **vendas (deals com `status='won'` e `won_at` no mês corrente, atribuídas via `responsible_user_id`)**.

## Tier Ladder (1 venda por nível)

| Vendas no mês | Tier      | Emoji |
|---------------|-----------|-------|
| 0             | Aquecendo | 🌱    |
| 1             | Latão     | 🟫    |
| 2             | Níquel    | ⚙️    |
| 3             | Bronze    | 🥉    |
| 4             | Prata     | 🥈    |
| 5             | Ouro      | 🥇    |
| 6             | Platinum  | 💠    |
| 7             | Diamond   | 💎    |
| 8 (cota)      | Black     | 🖤    |
| 9+            | Elite     | 👑    |

## Arquivos
- `src/hooks/useUserMonthlyTier.ts` — `TIER_LADDER`, `tierForSales`, `useUserMonthlyTier()`. Conta deals via Supabase (`responsible_user_id` + `status='won'` + `won_at` mês atual).
- `src/components/sales/quotas/TierProgressHero.tsx` — card com gradiente do tier, emoji, próxima meta e barra de progresso com pontos do ladder.
- `src/pages/SpiffsTracking.tsx` — aplica `tier.pageBg` (gradient suave) no fundo da página e renderiza o hero acima das abas.

## Regras
- Usa `responsible_user_id` (não `sales_user_id`, que não existe na tabela). Atribuição de SDR não conta para tier.
- Reset mensal (sempre 1º dia do mês corrente).
- Para usuários sem vendas (admin, RH, etc.) o tier é "Aquecendo" e o fundo é neutro — não polui.
- Para reuso em outras telas (CloserDashboard, Ranking), importar `useUserMonthlyTier` e `TIER_LADDER`.
