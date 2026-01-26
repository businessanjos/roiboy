
# Plano: Conceder Permissão de Atribuição de Contratos ao Papel "CX"

## Situação Atual

| Ação | Admin | CX | Outros |
|------|-------|-----|--------|
| Puxar cliente (para si) | ✅ | ✅ | ✅ |
| Atribuir a outro usuário | ✅ | ❌ | ❌ |

Atualmente, a linha 348 do `ContractTriageQueue.tsx` verifica apenas `isAdmin`:
```typescript
{isAdmin && (
  <Select ...>
```

## Solução Proposta

Importar o hook `useOperationRole` e modificar a condição para permitir que usuários com o papel "CX" também vejam o seletor de atribuição.

### Mudança 1: Importar o hook useOperationRole

**Arquivo:** `src/components/contracts/ContractTriageQueue.tsx`

Adicionar importação:
```typescript
import { useOperationRole } from "@/hooks/useOperationRole";
```

### Mudança 2: Usar o hook no componente

Dentro do componente, após `useCurrentUser`:
```typescript
const { roleName } = useOperationRole();
```

### Mudança 3: Alterar a condição de exibição do seletor

Modificar de:
```typescript
{isAdmin && (
```

Para:
```typescript
{(isAdmin || roleName === "CX") && (
```

Isso permite que:
1. Administradores continuem tendo acesso
2. Usuários com papel "CX" também tenham acesso ao seletor de atribuição

---

## Resultado Esperado

| Ação | Admin | CX | Outros |
|------|-------|-----|--------|
| Puxar cliente (para si) | ✅ | ✅ | ✅ |
| Atribuir a outro usuário | ✅ | ✅ | ❌ |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/contracts/ContractTriageQueue.tsx` | Importar `useOperationRole`, usar o hook, e expandir a condição de permissão para incluir "CX" |

---

## Considerações de Segurança

Esta mudança é apenas uma alteração de visibilidade na UI. A operação de atribuição (update no `clients.responsible_user_id`) já funciona para todos os usuários autenticados através do RLS da tabela `clients`. Não há risco de escalonamento de privilégios pois:

1. O hook apenas controla a exibição do seletor
2. A operação de banco já é permitida para usuários autenticados da mesma conta
3. O papel "CX" é um papel operacional legítimo da equipe
