

## Correção: Dados faltando na exportação do pipeline

### Causa raiz

Na linha 207, a query `deal_field_values` busca valores em chunks de 200 deals, mas **sem especificar `.limit()`**. O Supabase aplica um limite padrão de **1000 linhas por query**.

Com ~15-20 campos personalizados por negócio, cada chunk de 200 deals gera 3000-4000 linhas de field values. Apenas os primeiros 1000 são retornados — o restante é **silenciosamente descartado**, resultando em campos vazios na exportação.

### Solução

Duas mudanças em `src/components/sales/PipelineExportDialog.tsx`:

1. **Reduzir o tamanho do chunk** de 200 para 50 deals por iteração
2. **Adicionar `.limit(10000)`** na query para garantir que todos os valores sejam retornados

```typescript
// Linha 204: mudar CHUNK de 200 para 50
const CHUNK = 50;

// Linha 207-210: adicionar .limit(10000)
const { data } = await supabase
  .from("deal_field_values")
  .select("deal_id, field_id, value_text, value_number, value_boolean, value_date, value_json")
  .in("deal_id", chunk)
  .limit(10000);
```

### Arquivo afetado
- `src/components/sales/PipelineExportDialog.tsx` — linhas 204-210

