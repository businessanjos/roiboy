
# Plano: Verificação e Correção do Fluxo de Responsáveis (Vendedor vs Consultor)

## Diagnóstico Completo

Após investigação detalhada, identifiquei a causa raiz do problema:

### Clientes Afetados
| Cliente | Criado em | Consultor Atual | Sales_user_id |
|---------|-----------|-----------------|---------------|
| Dayse Magalhães | 26/01/2026 20:14 | George Oliveira | NULL |
| Murilo Joaquim | 26/01/2026 23:14 | Everton Pieri | NULL |

### Causa Raiz
Os clientes foram **convertidos ANTES** da migração que corrigiu o sistema (27/01/2026 18:15). Nesse período:

1. A função `convert_lead_to_client` ainda **não** havia sido corrigida
2. A coluna `sales_user_id` **ainda não existia**
3. Alguém atribuiu manualmente esses clientes via Triagem (ou edit), preenchendo `responsible_user_id` com vendedores

### Estado Atual do Sistema (Correto)
- ✅ Migração aplicada em 27/01/2026 adicionou `sales_user_id`
- ✅ Função `convert_lead_to_client` agora NÃO copia `responsible_user_id`
- ✅ `SalesPipeline.tsx` atualiza `sales_user_id` (linha 383) e NÃO `responsible_user_id`
- ✅ Triagem ordena do mais recente para o mais antigo (linha 153)

## Arquivos a Modificar (Correção de Ordenação)

Após revisar novamente o código, identifiquei que a ordenação na Triagem **já está implementada** na linha 150-156 de `ContractTriageQueue.tsx`:

```typescript
const triageContracts = useMemo(() => {
  return contracts
    .filter((contract) => !contract.client?.responsible_user_id)
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA; // Mais recente primeiro
    });
}, [contracts]);
```

## Ação Necessária: Correção Manual dos Dados Históricos

Os clientes mencionados (Dayse e Murilo) precisam de correção manual:

1. **Remover o responsável atual** (`responsible_user_id`) para que voltem para a Triagem
2. **Definir o vendedor** (`sales_user_id`) com o ID do vendedor do negócio

| Cliente | Ação |
|---------|------|
| Dayse Magalhães | `sales_user_id` = Everton Pieri, `responsible_user_id` = NULL |
| Murilo Joaquim | `sales_user_id` = Everton Pieri, `responsible_user_id` = NULL |

### SQL de Correção (Executar Manualmente)

```sql
-- Corrigir clientes que foram atribuídos incorretamente
-- Definir sales_user_id com o vendedor do negócio e limpar responsible_user_id

UPDATE clients 
SET 
  sales_user_id = (
    SELECT d.responsible_user_id 
    FROM deals d 
    WHERE d.client_id = clients.id 
    AND d.status = 'won'
    LIMIT 1
  ),
  responsible_user_id = NULL
WHERE id IN (
  '9aede114-19b0-4b87-b492-b6116675ffe7',  -- Murilo
  'a84ef3d0-6dfe-4125-a759-feb4d9dca730'   -- Dayse
);
```

## Fluxo Correto (Funcionando Após Correção)

```text
┌─────────────────────────────────────────────────────────────────┐
│                    LEAD → CLIENTE (CONVERSÃO)                   │
├─────────────────────────────────────────────────────────────────┤
│ 1. Vendedor marca negócio como "Ganho" no Pipeline             │
│                                                                 │
│ 2. Sistema executa convert_lead_to_client()                    │
│    → Cliente criado com responsible_user_id = NULL              │
│    → Cliente vai para Triagem da Operação                       │
│                                                                 │
│ 3. SalesPipeline.tsx atualiza sales_user_id                    │
│    → Cliente mantém referência ao vendedor                      │
│                                                                 │
│ 4. Contrato criado e enviado para Conciliação                  │
│                                                                 │
│ 5. Cliente aparece na Triagem da Operação                      │
│    → Consultor clica "Puxar" ou CX atribui                     │
│    → responsible_user_id = Consultor escolhido                  │
│                                                                 │
│ 6. Cliente possui 2 responsáveis distintos:                    │
│    → sales_user_id = Vendedor (contato periódico)              │
│    → responsible_user_id = Consultor (atendimento diário)      │
└─────────────────────────────────────────────────────────────────┘
```

## Verificação de Código (Sem Mudanças Necessárias)

| Arquivo | Status | Observação |
|---------|--------|------------|
| `convert_lead_to_client` (DB) | ✅ Correto | Não copia `responsible_user_id` |
| `SalesPipeline.tsx` | ✅ Correto | Atualiza apenas `sales_user_id` |
| `ContractTriageQueue.tsx` | ✅ Correto | Ordena por `created_at` DESC |
| `ClientDetail.tsx` | ✅ Correto | Exibe Consultor e Vendedor separados |

## Conclusão

O sistema está **corretamente implementado** para novas conversões. O problema observado são **dados históricos** de clientes convertidos antes da correção (26/01). 

A correção envolve:
1. Executar o SQL de correção para os clientes afetados
2. Verificar se existem outros clientes na mesma situação
3. Confirmar que novas conversões funcionam corretamente

Para identificar todos os clientes afetados (vendedores como consultores):

```sql
SELECT c.id, c.full_name, 
       u.name as consultor_atual,
       d.responsible_user_id as vendedor_do_negocio
FROM clients c
JOIN users u ON u.id = c.responsible_user_id
JOIN deals d ON d.client_id = c.id AND d.status = 'won'
WHERE c.sales_user_id IS NULL
AND c.responsible_user_id IS NOT NULL;
```
