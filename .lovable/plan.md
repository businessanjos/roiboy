
## Indicador de Status de Atividades em Tempo Real no DealCard

### Problema
Quando uma tarefa do negocio e concluida (via dialogo de atividades ou aba de atividades), o indicador de status no card ("Atrasado!", "A fazer", "Feito") nao atualiza imediatamente. O card depende exclusivamente de uma subscription Realtime do Supabase que pode ter latencia de 1-3 segundos ou falhar silenciosamente.

### Solucao
Migrar a busca de status de atividades do DealCard de `useState` + `useEffect` manual para **React Query**, permitindo que qualquer componente que conclua uma tarefa invalide o cache e force uma atualizacao imediata no card.

### Mudancas

**1. Criar hook `useDealActivityStatus`**
- Novo hook em `src/hooks/useDealActivityStatus.ts`
- Usa `useQuery` com query key `["deal-activity-status", dealId]`
- Mantem a mesma logica de busca (pending count, has overdue, total)
- Inclui subscription Realtime como complemento (para mudancas de outros usuarios)

**2. Atualizar `DealCard.tsx`**
- Remover o `useEffect` manual que faz fetch e subscribe (linhas 37-82)
- Remover o state `activityStatus`
- Usar o novo hook `useDealActivityStatus(deal.id)`
- Resultado: menos codigo, mesmo comportamento + reatividade via cache

**3. Atualizar `DealActivitiesDialog.tsx`**
- Apos concluir tarefa (`handleCompleteTask`), invalidar a query `["deal-activity-status", dealId]`
- Isso forca o DealCard a refazer a busca imediatamente

**4. Atualizar `DealActivitiesTab.tsx`**
- Nos mesmos pontos onde ja faz `invalidateQueries({ queryKey: ["internal-tasks"] })`, adicionar tambem `invalidateQueries({ queryKey: ["deal-activity-status"] })`

### Detalhes Tecnicos

```text
Fluxo atual (com latencia):
  Usuario completa tarefa --> DB atualiza --> Realtime notifica (1-3s) --> Card refaz fetch

Fluxo novo (instantaneo):
  Usuario completa tarefa --> DB atualiza --> invalidateQueries --> Card refaz fetch (imediato)
                                          --> Realtime (backup para outros usuarios)
```

**Query key**: `["deal-activity-status", dealId]` — permite invalidar um card especifico ou todos de uma vez.

**staleTime**: 30 segundos — evita refetches excessivos quando muitos cards estao visiveis no Kanban.

**Realtime mantido**: A subscription continua ativa como fallback para mudancas feitas por outros usuarios ou de outros dispositivos.
