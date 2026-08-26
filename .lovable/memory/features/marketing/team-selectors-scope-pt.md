---
name: Seletores de pessoas no Marketing
description: Qualquer seletor de pessoa dentro da área de Marketing lista apenas o time de marketing (user_sector_access sector_id='marketing')
type: feature
---
Todo seletor de pessoas dentro da área de Marketing (tarefas, projetos, ideias, checklist de conteúdo, eventos, agências) deve usar `useMarketingTeamUsers` / `useMarketingTeamUsersAuthIds` (`src/hooks/useMarketingTeamUsers.tsx`), que lê `user_sector_access` com `sector_id = 'marketing'` e `is_active = true`.

Nunca listar `users` da conta inteira nem listas fixas de e-mails.

Exceção: campo "Vendedor / SDR" em `MarketingLinksUtm.tsx` (utm_content) continua listando o time comercial, pois é atribuição de venda.
