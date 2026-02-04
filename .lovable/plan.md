

# Adicionar Filtros "Cancelado" e "Suspenso" ao Filtro de Contrato

## Resumo

Adicionar duas novas opções ao filtro de Contrato: "Cancelado" e "Suspenso", permitindo filtrar clientes com contratos nesses status.

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/client/ClientsFilters.tsx` | Adicionar opcoes "Cancelado" e "Suspenso" no Select |
| `supabase/functions/list-clients/index.ts` | Adicionar logica de filtragem por status |

## Detalhes Tecnicos

### 1. Frontend - ClientsFilters.tsx

Adicionar as novas opcoes no Select de Contrato (linhas 155-165):

```tsx
<SelectContent>
  <SelectItem value="all">Todos</SelectItem>
  <SelectItem value="active">Ativo</SelectItem>
  <SelectItem value="expired">Expirado</SelectItem>
  <SelectItem value="urgent">Expira em 30 dias</SelectItem>
  <SelectItem value="warning">Expira em 60 dias</SelectItem>
  <SelectItem value="ok">Vigente</SelectItem>
  <SelectItem value="pending">Pendente</SelectItem>
  <SelectItem value="cancelled">Cancelado</SelectItem>      {/* NOVO */}
  <SelectItem value="suspended">Suspenso</SelectItem>       {/* NOVO */}
  <SelectItem value="none">Sem contrato</SelectItem>
</SelectContent>
```

Atualizar o badge de filtro ativo (linha 226) para exibir os novos status corretamente.

### 2. Edge Function - list-clients/index.ts

Adicionar tratamento pre-paginacao para os novos filtros (similar ao filtro "active"):

```typescript
// Linha ~159-185: Adicionar logica para cancelled e suspended
if (contractFilter === "cancelled" || contractFilter === "suspended") {
  const { data: statusContracts } = await supabase
    .from("client_contracts")
    .select("client_id")
    .eq("account_id", accountId)
    .eq("status", contractFilter);
  
  const statusClientIds = [...new Set(statusContracts?.map(c => c.client_id) || [])];
  
  if (statusClientIds.length === 0) {
    return new Response(
      JSON.stringify({ clients: [], total: 0, limit, offset, team_users: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  query = query.in("id", statusClientIds);
}
```

Atualizar a condicao de skip no filtro pos-enriquecimento (linha 326):

```typescript
// Antes:
if (contractFilter && contractFilter !== "all" && contractFilter !== "active") {

// Depois:
if (contractFilter && contractFilter !== "all" && 
    contractFilter !== "active" && 
    contractFilter !== "cancelled" && 
    contractFilter !== "suspended") {
```

## Resultado Final

O dropdown de Contrato tera as seguintes opcoes:

- Todos
- Ativo
- Expirado
- Expira em 30 dias
- Expira em 60 dias
- Vigente
- Pendente
- **Cancelado** (novo)
- **Suspenso** (novo)
- Sem contrato

