
# Plano: Corrigir Filtros da Triagem de Operação

## Diagnóstico do Problema

### O Que Está Acontecendo

Os filtros (status, tipo, produto, busca) na aba "Triagem" não estão sendo aplicados à lista de contratos exibida.

### Causa Raiz Identificada

1. **`ContractTriageQueue` recebe `triageContracts` não filtrados** (linha 1926):
   ```tsx
   <ContractTriageQueue
     contracts={triageContracts as any}  // ← Sem filtros aplicados!
     teamUsers={teamUsers}
     ...
   />
   ```

2. **`triageContracts` é calculado sem considerar os filtros** (linhas 1414-1416):
   ```tsx
   const triageContracts = useMemo(() => {
     return contracts.filter(c => !c.client?.responsible_user_id);
   }, [contracts]);  // ← Apenas filtra por responsável, ignora os outros filtros
   ```

3. **`ContractTriageQueue` NÃO recebe as props de filtro** e portanto não pode aplicá-los.

### Resultado Visual

Na screenshot:
- Usuário seleciona filtro "Pendentes" (status = pending)
- A tabela continua mostrando contratos com status "Ativo"
- Os filtros não fazem efeito porque `ContractTriageQueue` ignora essas configurações

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/contracts/ContractTriageQueue.tsx` | Adicionar props de filtro e aplicar lógica de filtragem |
| `src/pages/Contracts.tsx` | Passar props de filtro para `ContractTriageQueue` |

## Solução Proposta

### 1. Modificar Interface de Props (`ContractTriageQueue.tsx`)

Adicionar novas props para receber os valores de filtro:

```typescript
interface ContractTriageQueueProps {
  contracts: Contract[];
  teamUsers: TeamUser[];
  onRefresh: () => void;
  onViewContract: (contract: Contract) => void;
  // Novas props de filtro
  searchTerm?: string;
  statusFilter?: string;
  typeFilter?: string;
  productFilter?: string;
  sortOrder?: "az" | "recent";
}
```

### 2. Aplicar Filtros Dentro do Componente (`ContractTriageQueue.tsx`)

Modificar o `useMemo` de `triageContracts` para aplicar todos os filtros:

```typescript
const triageContracts = useMemo(() => {
  return contracts
    .filter((contract) => {
      // 1. Filtro base: cliente sem responsável
      if (contract.client?.responsible_user_id) return false;
      
      // 2. Filtro de busca
      const matchesSearch = !searchTerm || 
        contract.client?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.notes?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 3. Filtro de status
      const isExpired = contract.end_date && 
        new Date(contract.end_date) < new Date() && 
        contract.status === "active";
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "expired" ? isExpired : contract.status === statusFilter);
      
      // 4. Filtro de tipo
      const matchesType = typeFilter === "all" || contract.contract_type === typeFilter;
      
      // 5. Filtro de produto
      const matchesProduct = productFilter === "all" || contract.product?.id === productFilter;
      
      return matchesSearch && matchesStatus && matchesType && matchesProduct;
    })
    .sort((a, b) => {
      if (sortOrder === "az") {
        const nameA = a.client?.full_name?.toLowerCase() || "";
        const nameB = b.client?.full_name?.toLowerCase() || "";
        return nameA.localeCompare(nameB, "pt-BR");
      }
      // Padrão: mais recentes primeiro
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });
}, [contracts, searchTerm, statusFilter, typeFilter, productFilter, sortOrder]);
```

### 3. Passar Props de Filtro (`Contracts.tsx`)

Na chamada do componente (linha ~1925):

```tsx
<ContractTriageQueue
  contracts={triageContracts as any}
  teamUsers={teamUsers}
  onRefresh={fetchContracts}
  onViewContract={(contract) => {
    setSelectedContract(contract as any);
    setDetailSheetOpen(true);
  }}
  // Novas props
  searchTerm={searchTerm}
  statusFilter={statusFilter}
  typeFilter={typeFilter}
  productFilter={productFilter}
  sortOrder={sortOrder}
/>
```

### 4. Atualizar Mensagem de "Nenhum Contrato" (`ContractTriageQueue.tsx`)

Diferenciar entre "não há contratos na triagem" e "filtros não retornaram resultados":

```tsx
if (triageContracts.length === 0) {
  const hasFiltersApplied = searchTerm || statusFilter !== "all" || 
    typeFilter !== "all" || productFilter !== "all";
    
  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <UserCheck className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">
            {hasFiltersApplied 
              ? "Nenhum contrato encontrado" 
              : "Nenhum cliente na triagem"}
          </p>
          <p className="text-sm">
            {hasFiltersApplied
              ? "Tente ajustar os filtros"
              : "Todos os clientes com contratos já possuem um responsável atribuído"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│              FILTROS DA TRIAGEM - FLUXO CORRIGIDO          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Contracts.tsx                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Estado dos Filtros:                                │    │
│  │  - searchTerm: "..."                               │    │
│  │  - statusFilter: "pending" | "active" | "all"...   │    │
│  │  - typeFilter: "compra" | "renovacao" | "all"...   │    │
│  │  - productFilter: "product-id" | "all"             │    │
│  │  - sortOrder: "az" | "recent"                      │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ <ContractTriageQueue                               │    │
│  │   contracts={triageContracts}                      │    │
│  │   searchTerm={searchTerm}         ← NOVO          │    │
│  │   statusFilter={statusFilter}     ← NOVO          │    │
│  │   typeFilter={typeFilter}         ← NOVO          │    │
│  │   productFilter={productFilter}   ← NOVO          │    │
│  │   sortOrder={sortOrder}           ← NOVO          │    │
│  │ />                                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ContractTriageQueue.tsx                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ useMemo(() => {                                    │    │
│  │   return contracts.filter(c => {                   │    │
│  │     // 1. Sem responsável (base)                   │    │
│  │     // 2. matchesSearch                            │    │
│  │     // 3. matchesStatus                            │    │
│  │     // 4. matchesType                              │    │
│  │     // 5. matchesProduct                           │    │
│  │   }).sort(...)                                     │    │
│  │ })                                                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  RESULTADO: Tabela mostra apenas contratos que             │
│  atendem TODOS os critérios selecionados                   │
└─────────────────────────────────────────────────────────────┘
```

## Comportamento Esperado Após a Correção

| Cenário | Antes | Depois |
|---------|-------|--------|
| Filtrar por "Pendentes" | Mostra todos os status | Mostra apenas status "pending" |
| Filtrar por "Compra" | Mostra todos os tipos | Mostra apenas tipo "compra" |
| Buscar por nome | Não filtra | Filtra por nome do cliente |
| Filtrar por produto | Não filtra | Mostra apenas do produto selecionado |
| Ordenar A-Z | Ordena só por data | Ordena alfabeticamente |
| Sem resultados com filtros | Mensagem genérica | "Tente ajustar os filtros" |

## Import Adicional

Adicionar import de `isPast` do date-fns em `ContractTriageQueue.tsx` para verificar contratos vencidos:

```typescript
import { format, isPast } from "date-fns";
```
