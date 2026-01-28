

# Plano: Corrigir Loop Infinito na Geração de Parcelas

## Problema Identificado

A investigação revelou que o bug está causando **duplicação de parcelas** no banco de dados. Um contrato que deveria ter 12 parcelas está com 23 parcelas (parcelas foram geradas 2 vezes).

### Causa Raiz

O ciclo de atualização está quebrando o estado do componente:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Usuário clica "Gerar Parcelas"                                      │
│  2. handleGenerateReceivables() insere parcelas no banco                │
│  3. setReceivablesGenerated(true) - estado LOCAL atualizado             │
│  4. onUpdate() chama fetchContracts()                                   │
│  5. Array contracts[] é atualizado com novos dados                      │
│  6. MAS selectedContract ainda tem valor ANTIGO (receivablesGenerated:  │
│     false)                                                              │
│  7. useEffect roda com initialReceivablesGenerated = false              │
│  8. setReceivablesGenerated(false) - estado LOCAL resetado!             │
│  9. Botão "Gerar Parcelas" aparece novamente                            │
│  10. Pode gerar novamente (loop)                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Evidência no Banco

| contract_id | created_at | count |
|-------------|------------|-------|
| 7b48b3aa-ef5f-4561-b422-10b9cfa05692 | 18:39:53 | 11 parcelas |
| 7b48b3aa-ef5f-4561-b422-10b9cfa05692 | 18:45:31 | 12 parcelas |
| **Total** | - | **23 parcelas** (deveria ser 12) |

## Solução: Três Camadas de Proteção

Para garantir que o problema **nunca mais ocorra**, implementaremos 3 níveis de proteção:

### 1. Atualizar selectedContract após fetchContracts (Página Contracts.tsx)

Quando `fetchContracts()` é chamado e há um `selectedContract` ativo, devemos sincronizá-lo com os dados atualizados:

```typescript
const fetchContracts = async () => {
  try {
    const { data, error } = await supabase
      .from("client_contracts")
      .select(`...`)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setContracts(data || []);
    
    // NOVO: Atualizar selectedContract com dados frescos
    if (selectedContract) {
      const updatedContract = (data || []).find(c => c.id === selectedContract.id);
      if (updatedContract) {
        setSelectedContract(updatedContract);
      }
    }
  } catch (error) {
    console.error("Error fetching contracts:", error);
    toast.error("Erro ao carregar contratos");
  } finally {
    setLoading(false);
  }
};
```

### 2. Guard no início da função de geração (ContractNegotiationTab.tsx)

Adicionar verificação dupla para evitar execução múltipla:

```typescript
const handleGenerateReceivables = async () => {
  // NOVO: Guard - verificar se já está gerando ou já gerou
  if (generating || receivablesGenerated) {
    console.warn('Generation already in progress or completed');
    return;
  }

  if (!paymentMethod) {
    toast.error("Selecione uma forma de pagamento");
    return;
  }
  // ... resto da função
};
```

### 3. Usar useRef para controlar estado de geração (ContractNegotiationTab.tsx)

Adicionar uma flag que persiste entre re-renders:

```typescript
// NOVO: Flag para prevenir dupla execução
const generatedRef = useRef(false);

const handleGenerateReceivables = async () => {
  // Triple-check: state, ref, e prop
  if (generating || receivablesGenerated || generatedRef.current) {
    console.warn('Generation blocked: already in progress or completed');
    return;
  }
  
  // Marcar imediatamente antes de qualquer operação async
  generatedRef.current = true;
  setGenerating(true);
  
  try {
    // ... operações de inserção
  } catch (error) {
    // Se falhar, permite tentar novamente
    generatedRef.current = false;
    // ...
  } finally {
    setGenerating(false);
  }
};

// Sincronizar ref com prop quando componente recebe novos dados
useEffect(() => {
  generatedRef.current = initialReceivablesGenerated;
}, [initialReceivablesGenerated]);
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Contracts.tsx` | Sincronizar `selectedContract` após `fetchContracts()` |
| `src/pages/financial/FinancialSalesReconciliationPage.tsx` | Mesmo ajuste para `detailContract` |
| `src/components/contracts/ContractNegotiationTab.tsx` | Adicionar `useRef` guard e validações extras |

## Mudanças Detalhadas

### Contracts.tsx (linhas ~392-411)

```typescript
const fetchContracts = async () => {
  try {
    const { data, error } = await supabase
      .from("client_contracts")
      .select(`
        *,
        client:clients(id, full_name, avatar_url, responsible_user_id),
        product:products(id, name, color)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    setContracts(data || []);
    
    // Sincronizar selectedContract com dados atualizados
    if (selectedContract) {
      const updatedContract = (data || []).find(c => c.id === selectedContract.id);
      if (updatedContract) {
        setSelectedContract(updatedContract);
      }
    }
  } catch (error) {
    console.error("Error fetching contracts:", error);
    toast.error("Erro ao carregar contratos");
  } finally {
    setLoading(false);
  }
};
```

### ContractNegotiationTab.tsx

```typescript
// Adicionar import useRef
import { useState, useEffect, useRef } from "react";

// Dentro do componente, após os useState:
const generatedRef = useRef(initialReceivablesGenerated);

// Sincronizar ref com prop
useEffect(() => {
  generatedRef.current = initialReceivablesGenerated;
}, [initialReceivablesGenerated]);

// Modificar handleGenerateReceivables:
const handleGenerateReceivables = async () => {
  // Triple-check para prevenir dupla execução
  if (generating || receivablesGenerated || generatedRef.current) {
    console.warn('Generation blocked: already in progress or completed');
    return;
  }
  
  if (!paymentMethod) {
    toast.error("Selecione uma forma de pagamento");
    return;
  }

  // Marcar imediatamente ANTES de qualquer operação async
  generatedRef.current = true;
  setGenerating(true);
  
  try {
    const entries = [];
    // ... resto da lógica de criação de entries
    
    const { error: entriesError } = await supabase
      .from("financial_entries")
      .insert(entries);

    if (entriesError) {
      generatedRef.current = false; // Permitir retry em caso de erro
      throw entriesError;
    }

    const { error: updateError } = await supabase
      .from("client_contracts")
      .update({
        receivables_generated: true,
        receivables_generated_at: new Date().toISOString(),
        payment_method: paymentMethod,
        installments_count: installments,
        first_due_date: firstDueDate,
      })
      .eq("id", contractId);

    if (updateError) {
      generatedRef.current = false; // Permitir retry em caso de erro
      throw updateError;
    }

    setReceivablesGenerated(true);
    toast.success(`${installments} parcela(s) gerada(s) no contas a receber`);
    onUpdate();
  } catch (error) {
    console.error("Error generating receivables:", error);
    toast.error("Erro ao gerar parcelas");
    generatedRef.current = false; // Permitir retry em caso de erro
  } finally {
    setGenerating(false);
  }
};
```

## Resultado Esperado

| Proteção | O que previne |
|----------|---------------|
| Sincronização de selectedContract | Props desatualizadas resetando estado local |
| `if (receivablesGenerated)` | Clique duplo quando estado já foi atualizado |
| `if (generatedRef.current)` | Clique durante re-render antes do state atualizar |
| `if (generating)` | Clique enquanto operação ainda está em andamento |

## Limpeza de Dados Duplicados

Após implementar a correção, o time do financeiro pode precisar limpar as parcelas duplicadas. Exemplo de query para identificar duplicatas:

```sql
-- Identificar contratos com parcelas duplicadas
SELECT contract_id, COUNT(*) as total
FROM financial_entries 
WHERE description LIKE 'Parcela%'
GROUP BY contract_id 
HAVING COUNT(*) > 12;
```

