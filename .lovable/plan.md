
# Correção do Isolamento de Dados na Agenda do Cliente

## 🔴 Problema Identificado

O componente de Agenda (`ClientAgenda.tsx`) está exibindo eventos de outros clientes porque:

1. **Seção "Agenda de Entregas"**: Busca TODOS os eventos do sistema e filtra apenas por produtos - qualquer cliente com os mesmos produtos vê os mesmos eventos
2. **Seção "Convites para Eventos"**: Não utiliza o hook `useLinkedClients` que outros componentes usam, causando inconsistência quando há clientes vinculados (casais)

## ✅ Solução

Implementar o mesmo padrão de isolamento usado em `ClientLifeEvents`, `ClientContracts` e `ClientFollowup`:

### Arquivo: `src/components/client/ClientAgenda.tsx`

**Mudanças:**

1. **Adicionar hook `useLinkedClients`**
   - Importar e usar o hook para obter IDs de clientes vinculados com `sync_data`

2. **Corrigir `fetchParticipations()`**
   - Alterar de `.eq("client_id", clientId)` para `.in("client_id", linkedClientIds)`
   - Adicionar suporte para mostrar badge "Via [Nome]" para convites de clientes vinculados

3. **Corrigir `fetchDeliveries()`**
   - Alterar de `.eq("client_id", clientId)` para `.in("client_id", linkedClientIds)`

4. **Corrigir `fetchAttendances()`**
   - Alterar de `.eq("client_id", clientId)` para `.in("client_id", linkedClientIds)`

5. **Corrigir `fetchFeedbacks()`**
   - Alterar de `.eq("client_id", clientId)` para `.in("client_id", linkedClientIds)`

6. **Corrigir `toggleDelivery()`**
   - Usar o `clientId` original (não linked) para criar novas entregas

7. **Adicionar dependência correta no useEffect**
   - Aguardar `linkedClientIds` antes de fazer fetch

### Fluxo de Dados Corrigido

```text
┌────────────────────────────────────────────────────────────────────┐
│  Cliente A (clientId: abc123)                                      │
│  └─ Vinculado ao Cliente B (sync_data = true)                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  useLinkedClients("abc123") retorna:                               │
│  linkedClientIds = ["abc123", "xyz789"]  ← inclui cliente B       │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  ANTES (ERRADO):                                                   │
│  .eq("client_id", clientId)                                        │
│  → Só retorna dados do cliente A                                   │
│  → Mas eventos por produto mostram TODOS os clientes!              │
│                                                                    │
│  DEPOIS (CORRETO):                                                 │
│  .in("client_id", linkedClientIds)                                 │
│  → Retorna dados do cliente A e B (se vinculados)                  │
│  → Eventos são filtrados por participação, não só produto          │
└────────────────────────────────────────────────────────────────────┘
```

## 📝 Detalhes Técnicos

### Imports a adicionar:
```typescript
import { useLinkedClients, getLinkedClientName } from "@/hooks/useLinkedClients";
```

### Hook no componente:
```typescript
export function ClientAgenda({ clientId, clientProductIds }: ClientAgendaProps) {
  const { linkedClientIds, linkedClients, hasLinkedClients, isLoading: linkedLoading } = useLinkedClients(clientId);
  // ... resto do código
```

### Queries corrigidas:
```typescript
// fetchDeliveries
.in("client_id", linkedClientIds)

// fetchAttendances  
.in("client_id", linkedClientIds)

// fetchParticipations
.in("client_id", linkedClientIds)

// fetchFeedbacks
.in("client_id", linkedClientIds)
```

### useEffect corrigido:
```typescript
useEffect(() => {
  if (accountId && linkedClientIds.length > 0) {
    fetchEvents();
    fetchDeliveries();
    fetchAttendances();
    fetchParticipations();
    fetchFeedbacks();
  }
}, [accountId, clientProductIds, clientId, linkedClientIds]);
```

## 🎯 Resultado Esperado

- ✅ Cada cliente vê SOMENTE sua própria agenda
- ✅ Clientes vinculados (casais) compartilham dados da agenda quando `sync_data = true`
- ✅ Modificações na agenda de um cliente NÃO afetam outros clientes
- ✅ Padrão consistente com outros componentes (Timeline, Contratos, Momentos CX)
