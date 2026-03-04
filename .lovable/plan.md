

## Simplificar Seleção de Campo de Segmentação

### Problema
A UI atual exige dois passos (escolher "Campo de Negócio" ou "Campo de Lead", depois escolher o campo) e não mostra todos os campos disponíveis juntos. O usuário quer **um único dropdown** listando todos os campos personalizados de Lead e Negócio, agrupados por origem.

### Solução

Substituir os dois dropdowns (Origem + Campo) por **um único Select** que lista todos os campos personalizados de ambas as entidades, agrupados visualmente:

```text
┌──────────────────────────────┐
│ Nenhum (sem segmentação)     │
│ ── Campos de Negócio ──     │
│ MQL                          │
│ Canal de Venda               │
│ ── Campos de Lead ──        │
│ Faturamento Atual            │
│ Origem do Lead               │
└──────────────────────────────┘
```

### Alterações

#### `VisualQuickSettings.tsx`

1. **Buscar campos de ambas as entidades** em um único `useEffect` — buscar `custom_fields` com `show_in_deals = true` e `show_in_leads = true` separadamente, depois combinar em uma lista com prefixo de source (`deal:` ou `lead:`)

2. **Substituir os dois Selects** (Origem + Campo) por um único Select com grupos:
   - Grupo "Campos de Negócio" — campos com `show_in_deals = true`
   - Grupo "Campos de Lead" — campos com `show_in_leads = true`
   - Valor codificado como `deal::{fieldId}` ou `lead::{fieldId}` para preservar a informação de source

3. **Remover** o estado `customFieldSource` e `availableCustomFields` — substituir por `allSegmentFields` (array com `{ id, name, source }`)

4. **Ao selecionar**, parsear o valor composto para extrair `source` e `fieldId`, e montar o `stackByCustomField` diretamente

### Arquivos afetados
- `src/components/insights/visuals/VisualQuickSettings.tsx` — simplificar UI de segmentação para um único dropdown agrupado

