
## Corrigir lista de solicitacoes de acesso nao atualizando no modal

### Problema

A solicitacao de acesso existe no banco de dados (email: joao.ferrari1982@gmail.com, status: pending), mas nao aparece no modal "Compartilhar Painel". A causa e um bug de dependencia nos `useEffect`:

1. Quando o modal abre, `fetchShare()` e chamado
2. `fetchShare()` busca o share e define `shareId`
3. `fetchRequests()` so executa quando `shareId` **muda**
4. Se o modal e reaberto, `shareId` ja tem o mesmo valor, entao `fetchRequests` **nao e chamado novamente**

Resultado: as solicitacoes so sao carregadas na primeira abertura do modal. Aberturas subsequentes mostram dados antigos.

### Solucao

**Arquivo**: `src/components/insights/ShareDashboardModal.tsx`

Alterar o `useEffect` do `fetchRequests` (linhas 84-86) para tambem depender de `open`. Assim, toda vez que o modal abrir E tiver um `shareId`, as solicitacoes serao recarregadas:

```typescript
useEffect(() => {
  if (open && shareId) fetchRequests();
}, [open, shareId, fetchRequests]);
```

Isso garante que ao reabrir o modal, as novas solicitacoes (como a que foi enviada) aparecam na lista.
