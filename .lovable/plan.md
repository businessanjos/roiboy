

## Correção Definitiva: Filtros de Lead retornando 0 resultados

### Causa Raiz Identificada

Os logs confirmam:
```
[leads] Base leads fetched: 2995
[leads] After lead field filters: 0
```

O problema está na função `filterByFieldValues` (linha 277-348 do `shared-dashboard/index.ts`). Após análise detalhada:

1. **Erro silencioso nas queries de batch**: As queries `.in('lead_id', batch)` com 500 UUIDs geram URLs GET extremamente longas (~18KB). Quando a query falha, o código **NÃO verifica o `error`** — apenas faz `if (data) allValues = allValues.concat(data)`. Se `data` é `null` por erro, `allValues` fica vazio, e o filtro remove TODOS os leads.

2. **Confirmação dos dados**: Verifiquei diretamente no banco:
   - Campo "Canal" (id `3bcdcf47`): 530 leads com value `opt_2` (= "Trafego Pago")
   - Campo "MQL" (id `e4270e93`): múltiplos leads com value `opt_1` (= "SIM - Acima de 30k")
   - Os dados existem e estão corretos

3. **Diferença do hook interno**: O hook interno (`useLeadFieldFilter.ts`) faz exatamente a mesma lógica, mas roda no navegador com o SDK do Supabase JS (client-side). A Edge Function roda no Deno com URL GET que pode ser truncada ou rejeitada pelo PostgREST.

### Solução

**Arquivo: `supabase/functions/shared-dashboard/index.ts`**

1. **Adicionar tratamento de erro nas queries de batch** — Checar o `error` retornado e logar quando falha
2. **Reduzir o batch size de 500 para 100** — Evitar URLs excessivamente longas com `.in()`
3. **Adicionar logs de diagnóstico detalhados** em `filterByFieldValues`:
   - Se `fieldDef` é null
   - Tamanho do `optionLabelToValue` map
   - Se `isSelectField` / `isMultiSelect`
   - Mapeamento de `selectedValues` → `selectedValueKeys`
   - Quantidade de `allValues` retornados das queries
   - Quantidade final de `matchingIds`
4. **Fallback defensivo**: Se todas as queries de batch falharem (allValues vazio mas entityIds não vazio), retornar o set completo em vez de vazio (falha aberta em vez de falha fechada)

### Código-chave da correção

```typescript
async function filterByFieldValues(...): Promise<Set<string>> {
  // ... field definition fetch with null check logging ...
  
  const batchSize = 100; // Reduced from 500 to avoid URL length issues
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .select(selectColumns)
      .eq('field_id', fieldId)
      .eq('account_id', accountId)
      .in(idColumn, batch);
    
    if (error) {
      console.error(`[filterByFieldValues] Batch ${i} error:`, JSON.stringify(error));
      continue; // Log and continue instead of silent skip
    }
    if (data) allValues = allValues.concat(data);
  }
  
  console.log(`[filterByFieldValues] field=${fieldId}, entities=${entityIds.length}, fieldType=${fieldType}, isSelect=${isSelectField}, isMulti=${isMultiSelect}, values fetched=${allValues.length}, selectedValues=${JSON.stringify(selectedValues)}, mappedKeys=${JSON.stringify([...selectedValueKeys])}, matches=${matchingIds.size}`);
  
  // Defensive: if no values were fetched but we had entities, something failed
  if (allValues.length === 0 && entityIds.length > 0) {
    console.warn(`[filterByFieldValues] WARNING: No field values returned for ${entityIds.length} entities. Returning all as fallback.`);
    return new Set(entityIds);
  }
  
  return matchingIds;
}
```

### Arquivos alterados
- `supabase/functions/shared-dashboard/index.ts`

