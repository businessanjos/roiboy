
# Plano: Isolar Campos por Setor e Restaurar Dados

## Problema Identificado

### 1. Bug no Diálogo de Configuração de Campos do Pipeline
O `DealFieldsConfigDialog` busca **TODOS os campos ativos** da conta, sem filtrar por setor:

```typescript
// ATUAL (bugado) - linha 92-97
supabase
  .from("custom_fields")
  .eq("account_id", accountId)
  .eq("is_active", true)  // ← Busca TUDO!
```

Isso faz campos de Operações (como "Você utiliza estratégias de vendas estruturadas?") aparecerem na lista de configuração do Pipeline.

### 2. Dados Corrompidos
O update anterior alterou incorretamente "Ganhou Bônus?" removendo-o de Vendas:
- **Atual**: `show_in_deals: false` 
- **Correto**: `show_in_deals: true`

## Solução

### Parte 1: Corrigir DealFieldsConfigDialog

Arquivo: `src/components/sales/DealFieldsConfigDialog/index.tsx`

Modificar a query para buscar **APENAS campos que já estão marcados para Deals** OU campos que podem ser adicionados ao Deals (que ainda não pertencem exclusivamente a outro setor):

```typescript
// CORRIGIDO - Mostrar apenas campos que:
// 1. Já estão em Deals (show_in_deals = true), OU
// 2. Não pertencem exclusivamente a outro setor
supabase
  .from("custom_fields")
  .select("id, name, field_type, show_in_deals, show_in_clients, show_in_leads, display_order, folder_id")
  .eq("account_id", accountId)
  .eq("is_active", true)
  .or("show_in_deals.eq.true,and(show_in_clients.eq.false,show_in_leads.eq.false)")
  .order("display_order"),
```

**Alternativa mais simples** (recomendada): Mostrar apenas campos que já pertencem a Deals:

```typescript
supabase
  .from("custom_fields")
  .select("id, name, field_type, show_in_deals, display_order, folder_id")
  .eq("account_id", accountId)
  .eq("is_active", true)
  .eq("show_in_deals", true)  // ← ADICIONAR este filtro
  .order("display_order"),
```

### Parte 2: Restaurar "Ganhou Bônus?" para Vendas

```sql
UPDATE custom_fields 
SET show_in_deals = true 
WHERE id = '82f58c54-d7e3-4d33-b73a-e214e1205b22';
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/sales/DealFieldsConfigDialog/index.tsx` | Adicionar filtro `show_in_deals = true` na query (linha 92-97) |
| Banco de dados | Restaurar "Ganhou Bônus?" com `show_in_deals = true` |

## Resultado Esperado

1. O diálogo "Personalizar Campos do Negócio" mostrará **apenas** campos que pertencem ao setor de Vendas
2. Campos de Operações como "Você utiliza estratégias..." **não** aparecerão no Pipeline
3. "Ganhou Bônus?" voltará a aparecer no Pipeline
4. "Cidade" continuará aparecendo em ambos os setores (comportamento atual correto)

## Nota sobre a Imagem

Os campos que aparecem na imagem que você enviou e que **não deveriam estar lá**:
- "Você utiliza estratégias de vendas estruturadas?" → Campo de Operações
- "Você possui um público-alvo claramente definido?" → Campo de Operações  
- "Você utiliza alguma ferramenta de CRM ou gestão de leads?" → Campo de Operações

Estes campos estão com `show_in_clients: true` e `show_in_deals: false`, então **teoricamente não deveriam aparecer no Pipeline**. Vou verificar se há outro local que está buscando esses campos incorretamente, pois o `DealDetailSheet` já filtra corretamente por `show_in_deals = true`.

Após a correção, esses campos de Operações deixarão de aparecer no diálogo de configuração do Pipeline e, consequentemente, não poderão ser ativados acidentalmente.
