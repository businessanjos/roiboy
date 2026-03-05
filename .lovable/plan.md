

## Plano: Filtro inline na coluna "Origem" + persistência de filtros

### O que será feito
1. Adicionar filtro inline (ícone funil + popover com checkboxes) na coluna **"Origem"** (`source`), idêntico ao já existente em "Origem da Venda" (`deal_source`)
2. **Persistir ambos os filtros** usando `usePersistedFilter` para que sobrevivam à navegação entre páginas

### Alterações em `src/components/insights/visuals/ConfigurableTable.tsx`

1. **Importar** `usePersistedFilter` de `@/hooks/usePersistedFilter`

2. **Generalizar filtros**: Substituir o estado `dealSourceFilter` (que é um `useState<Set>`) por dois `usePersistedFilter` com chaves únicas baseadas no `config.id` do visual:
   - `usePersistedFilter<string[]>('table', `${config.id}_source`, [])` → filtro da coluna Origem
   - `usePersistedFilter<string[]>('table', `${config.id}_deal_source`, [])` → filtro da coluna Origem da Venda
   - Usar arrays (`string[]`) em vez de `Set` pois `usePersistedFilter` serializa para JSON

3. **Extrair valores únicos** para ambas as colunas via `useMemo`:
   - `uniqueSources`: valores únicos de `r.extra?.source`
   - `uniqueDealSources`: já existente

4. **Aplicar filtros combinados** (AND): filtrar records que satisfaçam ambos os filtros ativos simultaneamente

5. **Definir colunas filtráveis**: Array constante `FILTERABLE_COLUMNS = ['source', 'deal_source']`. No render do header, verificar se `col.key` está nessa lista e renderizar o popover de filtro correspondente

6. **Refatorar UI do header**: Extrair a lógica do popover de filtro para evitar duplicação — um bloco condicional genérico que recebe o `col.key`, os valores únicos e o estado do filtro correspondente

### Fluxo de persistência
```
Usuário seleciona filtro → usePersistedFilter grava no localStorage
Usuário sai da página → volta → usePersistedFilter restaura do localStorage
Chave: roy_filters_{userId}_table_{visualId}_{columnKey}
```

### Arquivo afetado
- **Editar**: `src/components/insights/visuals/ConfigurableTable.tsx`

