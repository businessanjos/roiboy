
# Plano: Corrigir Filtro de Contrato Aplicado Antes da Paginação

## Problema Identificado

O filtro de contrato está sendo aplicado **depois** da paginação, causando resultados incorretos:

```text
┌─────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL (INCORRETO)                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Busca 50 clientes da Michele (ordenados por nome)        │
│ 2. Enriquece com dados de contrato de client_contracts      │
│ 3. Aplica filtro: contract.status === "active"              │
│ 4. Resultado: ~70 clientes (perdendo os que foram           │
│    filtrados após a paginação)                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FLUXO CORRETO                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. Busca IDs dos clientes com contrato active               │
│ 2. Filtra clientes por esses IDs + responsible_user         │
│ 3. Aplica paginação (50 por página)                         │
│ 4. Enriquece com dados adicionais                           │
│ 5. Resultado: 84 clientes em 2 páginas                      │
└─────────────────────────────────────────────────────────────┘
```

## Solução Proposta

Modificar a Edge Function `list-clients` para aplicar o filtro de contrato **antes** da paginação, usando uma subquery para buscar os client_ids elegíveis.

## Arquivo a Modificar

**supabase/functions/list-clients/index.ts**

## Alterações Detalhadas

### 1. Buscar IDs de clientes com contrato active antes da query principal

Quando `contractFilter === "active"`, primeiro buscar os client_ids que têm contrato com status active:

```typescript
// Se filtro de contrato active, buscar IDs elegíveis primeiro
let contractFilterClientIds: string[] | null = null;
if (contractFilter === "active") {
  const { data: activeContracts } = await supabase
    .from("client_contracts")
    .select("client_id")
    .eq("account_id", accountId)
    .eq("status", "active");
  
  contractFilterClientIds = [...new Set(activeContracts?.map(c => c.client_id) || [])];
  
  if (contractFilterClientIds.length === 0) {
    // Nenhum cliente com contrato active
    return Response com lista vazia;
  }
}
```

### 2. Aplicar filtro na query principal

Adicionar o filtro de client_ids na query principal de clientes, antes da paginação:

```typescript
// Aplicar filtro de contrato active (antes da paginação)
if (contractFilterClientIds && contractFilterClientIds.length > 0) {
  query = query.in("id", contractFilterClientIds);
}
```

### 3. Remover filtro pós-paginação para "active"

Ajustar a lógica que aplica filtros após o enriquecimento para não processar "active" novamente:

```typescript
if (contractFilter && contractFilter !== "all" && contractFilter !== "active") {
  // Filtros de data (expired, urgent, warning, ok, none)
  // Esses ainda precisam ser aplicados pós-enriquecimento
}
```

## Detalhes Técnicos

| Item | Antes | Depois |
|------|-------|--------|
| Filtro active | Pós-paginação | Pré-paginação via subquery |
| Outros filtros (expired, urgent, etc.) | Pós-paginação | Mantém pós-paginação |
| Performance | N queries | N+1 query (para active) |
| Precisão | Incorreta | Correta |

## Resultado Esperado

- Michele Santos verá **84 clientes** ao filtrar por "Contrato: Ativo"
- A paginação funcionará corretamente (páginas de 50)
- Total exibido corresponderá ao número real de clientes filtrados
