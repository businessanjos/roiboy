

# Plano: Adicionar Opção "Ativo" ao Filtro de Contratos

## Problema Identificado

O filtro de "Contrato" na página de Clientes atualmente oferece estas opções:
- Todos
- Expirado (contratos com data de fim no passado)
- Expira em 30 dias
- Expira em 60 dias  
- Vigente (contratos com data de fim futura > 90 dias)
- Sem contrato

**Falta a opção "Ativo"** que filtraria por contratos com `status = "active"`, independente da data de expiração.

### Diferença entre "Vigente" e "Ativo"
- **Vigente**: Filtro baseado na **data de expiração** (não expirado, com mais de 90 dias restantes)
- **Ativo**: Filtro baseado no **status do contrato** (`contract.status === "active"`)

Um contrato pode ter status "active" mas estar prestes a expirar (30 dias), o que o classificaria como "urgent" no filtro atual, mas ainda deveria aparecer quando filtrado por "Ativo".

## Solução Proposta

Adicionar a opção "Ativo" (`value="active"`) ao dropdown de filtro de contratos em dois lugares:
1. Frontend: `src/pages/Clients.tsx`
2. Backend: `supabase/functions/list-clients/index.ts`

## Alterações Técnicas

### 1. Frontend - src/pages/Clients.tsx

**Linha 1974-1981** - Adicionar opção "Ativo" no dropdown:

```typescript
<SelectContent>
  <SelectItem value="all">Todos</SelectItem>
  <SelectItem value="active">Ativo</SelectItem>      // <-- NOVA OPÇÃO
  <SelectItem value="expired">Expirado</SelectItem>
  <SelectItem value="urgent">Expira em 30 dias</SelectItem>
  <SelectItem value="warning">Expira em 60 dias</SelectItem>
  <SelectItem value="ok">Vigente</SelectItem>
  <SelectItem value="none">Sem contrato</SelectItem>
</SelectContent>
```

**Linha 2048-2055** - Atualizar o resumo de filtros ativos:

```typescript
Contrato: {filterContract === "active" ? "Ativo" : filterContract === "expired" ? "Expirado" : ...}
```

### 2. Backend - supabase/functions/list-clients/index.ts

**Linhas 272-292** - Adicionar tratamento para `contractFilter === "active"`:

```typescript
if (contractFilter && contractFilter !== "all") {
  if (contractFilter === "none") {
    filteredClients = filteredClients.filter(c => !c.contract);
  } else if (contractFilter === "active") {
    // NOVO: Filtrar por status do contrato = active
    filteredClients = filteredClients.filter(c => c.contract?.status === "active");
  } else {
    // ... resto da lógica de datas existente
  }
}
```

### 3. Componente ClientsFilters.tsx (opcional)

Se este componente também for usado, adicionar a mesma opção:

**Linhas 155-163**:
```typescript
<SelectItem value="active">Ativo</SelectItem>
```

**Linha 225** - Atualizar exibição do badge:
```typescript
filterContract === "active" ? "Ativo" : ...
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Clients.tsx` | Adicionar opção "Ativo" no Select e no badge de filtros ativos |
| `supabase/functions/list-clients/index.ts` | Adicionar lógica para filtrar por `contract.status === "active"` |
| `src/components/client/ClientsFilters.tsx` | Adicionar opção "Ativo" (se usado) |

## Resultado Esperado

Ao selecionar "Ativo" no filtro de Contrato:
1. Serão exibidos apenas clientes cujo contrato tem `status = "active"`
2. Isso inclui contratos ativos que estão prestes a expirar
3. A Michele Santos poderá filtrar suas alunas com contratos ativos facilmente

