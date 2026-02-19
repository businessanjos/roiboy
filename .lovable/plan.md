

## Adicionar product_id ao output do get-lead-deals

O campo "Item da Venda" (que contem o product_id) nao e uma coluna da tabela `deals` -- ele e armazenado na tabela `deal_field_values` com o `field_id = '033b91fb-3add-4c96-aec9-567fefbd0fb2'`.

### Alteracao

**Arquivo**: `supabase/functions/get-lead-deals/index.ts`

Apos buscar os deals, fazer uma segunda query para buscar os `deal_field_values` correspondentes ao campo "Item da Venda" para todos os deals retornados, e incluir o `product_id` (valor do campo `value_text`) no output de cada deal.

### Logica

```text
1. Buscar deals normalmente (como ja faz)
2. Extrair os IDs dos deals retornados
3. Buscar em deal_field_values WHERE field_id = '033b91fb...' AND deal_id IN (...)
4. Mapear cada deal ao seu product_id (value_text)
5. Incluir "product_id" no JSON de cada deal
```

### Output esperado por deal

Cada deal no array passara a incluir:
- `product_id`: o UUID do produto (ou null se nao preenchido)

