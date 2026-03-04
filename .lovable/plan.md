
## Correção: Exportação de negócios com campos personalizados incompletos

### Problema
A função `resolveLabel` no `PipelineExportDialog.tsx` só trata corretamente `select`, `multi_select`, `boolean` e `currency`. Campos como `location`, `user`, `multi_instagram` e `instagram` caem no caso default (`String(rawValue ?? "")`), que:
- Para `location`: produz `[object Object]` ou string vazia (JSON object com `formatted_address`, `city`, `state`)
- Para `user`: produz IDs de usuário em vez de nomes
- Para `multi_instagram`: pode não formatar corretamente o array

Além disso, o campo "Item da Venda" (product) armazena um `value_text` com o ID do produto, mas não é resolvido para o nome do produto.

### Solução
Atualizar `resolveLabel` para tratar todos os tipos de campo corretamente, usando a mesma lógica já provada em `formatFieldValueForTimeline` (do `dealToClientContractMapping.ts`):

```typescript
const resolveLabel = (field: CustomFieldDef, rawValue: any): string => {
  if (rawValue == null) return "";
  switch (field.field_type) {
    case "select": // resolve option label
    case "multi_select": // resolve option labels, join
    case "boolean": // Sim/Não
    case "currency": // R$ format
    case "location": // formatted_address ou city, state
    case "user": // resolve user names from usersMap
    case "multi_instagram": // join array
    case "instagram": // direct text
    case "text": // direct text
    case "number": // to string
    case "date": // already formatted before reaching here
  }
};
```

Tratamentos específicos:
1. **location**: Extrair `formatted_address` ou `city, state` do objeto JSON
2. **user**: Resolver IDs de usuário para nomes via `usersMap`
3. **multi_instagram**: Join do array com ", "
4. **Item da Venda**: Resolver ID do produto para nome via `productsMap`

### Arquivo afetado
- `src/components/sales/PipelineExportDialog.tsx` — função `resolveLabel` (linhas 168-191)
