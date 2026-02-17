

## Corrigir filtros de campos personalizados para campos multi_select

### Problema

Os filtros por campo personalizado do Negocio (e potencialmente do Lead) nao funcionam para campos do tipo `multi_select`. O motivo e que campos `multi_select` armazenam os valores na coluna `value_json` (como array JSON, ex: `["opt_1767723846709"]`), enquanto o codigo atual so consulta a coluna `value_text`, que e `null` para esses campos.

Exemplo concreto: o campo "Origem da Venda" e `multi_select`. Ao filtrar por "[TRAF-IMP-EC]", o sistema busca em `value_text` que esta `null`, retornando zero resultados mesmo com negocios existentes.

### Solucao

Atualizar ambos os utilitarios de filtragem para verificar tambem `value_json` quando o campo for do tipo `multi_select`.

### Mudancas tecnicas

**1. `src/hooks/useDealFieldFilter.ts`**

- Buscar tambem `field_type` na consulta do `custom_fields` (alem de `options`)
- Quando `field_type === 'multi_select'`:
  - Buscar `value_json` em vez de `value_text` da tabela `deal_field_values`
  - Comparar cada valor do array JSON contra os valores selecionados (mapeados de labels para option values)
- Quando `field_type === 'select'`:
  - Manter logica atual (`value_text` comparado com option values)
- Para campos sem options (texto livre):
  - Manter logica atual (`value_text` comparado diretamente)

**2. `src/hooks/useLeadFieldFilter.ts`**

- Mesma correcao: buscar `field_type` junto com `options`
- Para `multi_select`: buscar `value_json` de `lead_field_values` e verificar se algum valor do array esta nos valores selecionados
- Para `select` e texto livre: manter logica atual

### Logica de matching para multi_select

```
// value_json contem um array como ["opt_1767723846709"]
// selectedValues contem labels como ["[TRAF-IMP-EC]"]
// optionLabelToValue mapeia label -> value (ex: "[TRAF-IMP-EC]" -> "opt_1767723846709")

Para cada row:
  Se value_json e um array:
    Para cada valor no array:
      Se valor esta nos selectedValueKeys -> marcar deal como match
```

| Arquivo | Mudanca |
|---------|---------|
| `useDealFieldFilter.ts` | Buscar `field_type`, adicionar suporte a `multi_select` via `value_json` |
| `useLeadFieldFilter.ts` | Mesma correcao para filtros de lead com campos `multi_select` |
