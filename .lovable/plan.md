

## Plano: Corrigir filtro de Status na Tabela de Negócios

### Problema

O componente `ConfigurableTable` usa o hook `useVisualDrilldown` para buscar dados. A função `fetchDealsRecords` nesse hook **não aplica** o campo `dealStatusFilter` (filtro multi-valor de status). Ela só reconhece o `statusFilter` legado (valor único). O filtro de status adicionado recentemente grava em `dealStatusFilter` (array), mas o drilldown ignora esse campo.

### Correção — `src/hooks/useVisualDrilldown.ts`

Na função `fetchDealsRecords`, após a linha 86 (onde aplica `effectiveStatusFilter`), adicionar lógica para aplicar `dealStatusFilter` quando presente — usando `.in('status', dealStatusFilter)`. O `dealStatusFilter` deve ter prioridade sobre o `statusFilter` legado, igual à lógica já implementada em `useVisualData.ts`.

**Linhas ~82-86**: Alterar para:
```typescript
// Apply deal status filter (multi-value) or legacy single status filter
if (config.dealStatusFilter?.length) {
  query = query.in('status', config.dealStatusFilter);
} else if (effectiveStatusFilter) {
  query = query.eq('status', effectiveStatusFilter);
}
```

### Arquivo alterado
- `src/hooks/useVisualDrilldown.ts`

