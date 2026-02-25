

## Corrigir isolamento de dados na Agenda do Cliente

### Problema

Quando o usuario navega entre perfis de clientes (Client A -> Client B), o componente `ClientAgenda` **nao remonta** - o React reutiliza a mesma instancia e apenas atualiza as props. Isso causa dois problemas graves:

1. **Estado stale**: Os eventos do Client A permanecem visiveis ate que os dados do Client B terminem de carregar. Durante essa janela, o usuario pode editar ou interagir com eventos do cliente errado.
2. **Closures stale**: As funcoes `fetchEvents`, `fetchDeliveries`, etc. nao sao memoizadas com `useCallback`, entao podem capturar valores antigos de `linkedClientIds` ou `clientProductIds`.
3. **Sem reset de estado**: Quando `clientId` muda, os estados internos (`events`, `deliveries`, `attendances`, `editingEvent`, etc.) nao sao limpos.

### Solucao (2 camadas de protecao)

#### Camada 1: Forcar remontagem com `key` (ClientDetail.tsx)

**Arquivo:** `src/pages/ClientDetail.tsx` (~linha 2289)

Adicionar `key={id}` ao componente `ClientAgenda` para forcar o React a destruir e recriar o componente quando o `id` do cliente muda:

```tsx
<ClientAgenda 
  key={id}
  clientId={id!} 
  clientProductIds={clientProducts.map(p => p.id)} 
/>
```

Isso garante que TODO o estado interno e resetado ao navegar entre clientes.

#### Camada 2: Reset explicito de estado quando clientId muda (ClientAgenda.tsx)

**Arquivo:** `src/components/client/ClientAgenda.tsx`

Adicionar um `useEffect` que limpa todos os estados internos quando `clientId` muda, como segunda camada de seguranca:

```tsx
// Reset all state when clientId changes to prevent cross-client contamination
useEffect(() => {
  setEvents([]);
  setDeliveries([]);
  setAttendances([]);
  setParticipations([]);
  setFeedbacks([]);
  setEditingEvent(null);
  setEditDialogOpen(false);
  setCreateDialogOpen(false);
  setLoading(true);
}, [clientId]);
```

#### Camada 3: Memoizar funcoes de fetch com useCallback

Envolver `fetchEvents` e as demais funcoes de fetch com `useCallback` incluindo todas as dependencias corretas (`linkedClientIds`, `clientProductIds`, `accountId`). Isso garante que o useEffect sempre chame a versao mais atualizada das funcoes.

### Resumo das mudancas

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/ClientDetail.tsx` | Adicionar `key={id}` no `<ClientAgenda>` |
| `src/components/client/ClientAgenda.tsx` | Adicionar useEffect de reset de estado + memoizar funcoes com useCallback |

