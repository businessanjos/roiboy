
# Correção dos Cards de Métricas do Dashboard

## Problema Identificado

Os cards do dashboard estão exibindo valores incorretos por **três razões principais**:

### 1. Hook `useClientsWithScores` filtra apenas clientes com contratos ativos/pendentes

```typescript
// Linhas 91-94 do useDashboardData.tsx
const { data: contractsData } = await supabase
  .from("client_contracts")
  .select("client_id, status")
  .in("status", ["active", "pending"]); // ⚠️ EXCLUI cancelled, ended, suspended
```

Isso faz com que clientes que têm **apenas** contratos cancelados/encerrados não apareçam na contagem do dashboard.

### 2. Cards usam status errados para contagem

| Card | Status Usado | Status Correto |
|------|--------------|----------------|
| Cancelamentos | `clients.status === "churned"` | `contracts.status === "cancelled"` |
| Encerramentos | Conta apenas do mês atual | Total de `contracts.status === "ended"` |
| Congelamentos | `clients.status === "paused"` | `contracts.status === "suspended"` |

### 3. Mistura de métricas de clientes vs contratos

Os cards misturam dados da tabela `clients` (status do cliente) com dados da tabela `client_contracts` (status do contrato), causando inconsistência.

---

## Dados Reais no Banco

| Tabela | Status | Quantidade |
|--------|--------|------------|
| `client_contracts` | active | 276 |
| `client_contracts` | cancelled | 88 |
| `client_contracts` | ended | 156 |
| `client_contracts` | suspended | 21 |
| `client_contracts` | paused | 7 |
| `clients` | active | 449 |
| `clients` | churn_risk | 748 |

---

## Solução Proposta

### Opção A: Usar RPC para Agregação no Banco (Recomendado)

Criar funções SQL que retornam contagens precisas, evitando o limite de 1000 rows e garantindo precisão:

```sql
CREATE OR REPLACE FUNCTION get_contract_status_counts(p_account_id UUID)
RETURNS TABLE(
  active_count BIGINT,
  cancelled_count BIGINT,
  ended_count BIGINT,
  suspended_count BIGINT,
  paused_count BIGINT,
  total_clients BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    COUNT(*) FILTER (WHERE status = 'ended') as ended_count,
    COUNT(*) FILTER (WHERE status = 'suspended') as suspended_count,
    COUNT(*) FILTER (WHERE status = 'paused') as paused_count,
    COUNT(DISTINCT client_id) as total_clients
  FROM public.client_contracts
  WHERE account_id = p_account_id;
$$;
```

### Opção B: Modificar Hook para Buscar Todos os Status

Remover o filtro de status no hook e calcular contagens baseadas nos contratos:

```typescript
// Buscar TODOS os contratos, não apenas active/pending
const { data: contractsData } = await supabase
  .from("client_contracts")
  .select("client_id, status"); // Sem filtro de status
```

---

## Implementação Detalhada

### Arquivo 1: Criar RPC (Migração SQL)

```sql
-- Função para obter contagens de status de contratos
CREATE OR REPLACE FUNCTION get_dashboard_contract_counts(p_account_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active', COUNT(*) FILTER (WHERE status = 'active'),
    'cancelled', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'ended', COUNT(*) FILTER (WHERE status = 'ended'),
    'suspended', COUNT(*) FILTER (WHERE status = 'suspended'),
    'paused', COUNT(*) FILTER (WHERE status = 'paused'),
    'total_clients', COUNT(DISTINCT client_id)
  ) INTO result
  FROM public.client_contracts
  WHERE account_id = p_account_id;
  
  RETURN result;
END;
$$;
```

### Arquivo 2: `src/hooks/useDashboardContractStats.ts` (Novo)

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContractStats {
  active: number;
  cancelled: number;
  ended: number;
  suspended: number;
  paused: number;
  total_clients: number;
}

export function useDashboardContractStats(accountId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard-contract-stats", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      
      const { data, error } = await supabase
        .rpc("get_dashboard_contract_counts", { p_account_id: accountId });
      
      if (error) throw error;
      return data as ContractStats;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5,
  });
}
```

### Arquivo 3: `src/pages/Dashboard.tsx` (Modificar)

Atualizar os cards para usar os dados corretos:

```tsx
// Importar novo hook
import { useDashboardContractStats } from "@/hooks/useDashboardContractStats";

// Usar hook
const { data: contractStats } = useDashboardContractStats(currentUser?.account_id);

// Atualizar cards
<p className="text-2xl font-bold">{contractStats?.cancelled ?? 0}</p> // Cancelamentos
<p className="text-2xl font-bold">{contractStats?.ended ?? 0}</p>     // Encerramentos
<p className="text-2xl font-bold">{contractStats?.suspended ?? 0}</p> // Congelamentos
```

---

## Resultado Esperado

| Card | Valor Atual | Valor Correto |
|------|-------------|---------------|
| Total Clientes | 271 | ~276+ (clientes únicos com contratos) |
| Ativos | 271 | 276 (contratos ativos) |
| Cancelamentos | 0 | 88 |
| Encerramentos | 0 | 156 |
| Congelamentos | 0 | 21 (suspended) + 7 (paused) = 28 |

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar função RPC `get_dashboard_contract_counts` |
| `src/hooks/useDashboardContractStats.ts` | Criar novo hook para chamar RPC |
| `src/pages/Dashboard.tsx` | Integrar novo hook e corrigir exibição dos cards |
