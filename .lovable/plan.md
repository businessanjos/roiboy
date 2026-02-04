
# Corrigir Filtros de Contrato na Página Principal de Clientes

## Problema Identificado

O filtro de contrato está implementado em **dois locais diferentes**:

1. `src/components/client/ClientsFilters.tsx` - Componente compartilhado (já atualizado)
2. `src/pages/Clients.tsx` - Filtros inline na página principal (NÃO atualizado)

A página que você está usando (`/clients`) renderiza os filtros diretamente no arquivo `Clients.tsx`, por isso as novas opções não aparecem.

## Modificações Necessárias

### Arquivo: `src/pages/Clients.tsx`

**1. Adicionar opções no Select (linhas 1974-1982)**

Incluir "Cancelado" e "Suspenso" entre "Vigente" e "Sem contrato":

```tsx
<SelectContent>
  <SelectItem value="all">Todos</SelectItem>
  <SelectItem value="active">Ativo</SelectItem>
  <SelectItem value="expired">Expirado</SelectItem>
  <SelectItem value="urgent">Expira em 30 dias</SelectItem>
  <SelectItem value="warning">Expira em 60 dias</SelectItem>
  <SelectItem value="ok">Vigente</SelectItem>
  <SelectItem value="pending">Pendente</SelectItem>
  <SelectItem value="cancelled">Cancelado</SelectItem>    // NOVO
  <SelectItem value="suspended">Suspenso</SelectItem>     // NOVO
  <SelectItem value="none">Sem contrato</SelectItem>
</SelectContent>
```

**2. Atualizar badge de filtro ativo (linha 2051)**

Adicionar os labels para "Cancelado" e "Suspenso" na lógica condicional do Badge.

## Resumo

| Arquivo | Linha | Modificação |
|---------|-------|-------------|
| `src/pages/Clients.tsx` | 1980-1981 | Adicionar SelectItem para "Cancelado" e "Suspenso" |
| `src/pages/Clients.tsx` | 2051 | Atualizar lógica do Badge para exibir novos labels |

Após essa correção, as opções aparecerão corretamente no dropdown de Contrato.
