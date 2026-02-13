
## Sincronizar campos da API com campos personalizados do Lead

### Problema
Os campos `mql`, `canal` e `revenue_range` sao salvos nas colunas da tabela `leads`, mas a UI exibe dados atraves do sistema de **campos personalizados** (tabela `lead_field_values`). Por isso, mesmo com os valores chegando corretamente via API, eles nao aparecem no detalhe do Lead.

### Solucao
Atualizar a edge function `create-lead` para, apos criar o lead, tambem inserir os valores nos campos personalizados correspondentes na tabela `lead_field_values`.

### Mapeamento dos campos personalizados (IDs ja existentes no banco)

| Campo API       | Custom Field ID                        | Nome no sistema      |
|-----------------|----------------------------------------|----------------------|
| `mql`           | `e4270e93-e9b9-4d9b-9589-d614ce335bcd` | MQL                  |
| `canal`         | `3bcdcf47-076e-47f2-a1ab-a4dd1ec8398a` | Canal                |
| `revenue_range` | `e352a1ca-cfbc-435a-95f7-2f53b5cac041` | Faturamento Atual    |

### Mudanca tecnica

**Arquivo: `supabase/functions/create-lead/index.ts`**

Apos o insert do lead (linha 100), adicionar logica para inserir em `lead_field_values`:

```text
// Mapear campos para custom fields
const fieldMappings = [
  { fieldId: "e4270e93-...", value: payload.mql },
  { fieldId: "3bcdcf47-...", value: payload.canal },
  { fieldId: "e352a1ca-...", value: payload.revenue_range },
];

// Inserir apenas campos com valor preenchido
const fieldInserts = fieldMappings
  .filter(m => m.value?.trim())
  .map(m => ({
    lead_id: newLead.id,
    field_id: m.fieldId,
    account_id: accountId,
    value_text: m.value.trim(),
  }));

if (fieldInserts.length > 0) {
  await supabase.from("lead_field_values").insert(fieldInserts);
}
```

### O que nao muda
- JSON do n8n (ja esta correto com `mql`, `canal`, `revenue_range`)
- Colunas na tabela leads (continuam sendo populadas)
- UI do detalhe do Lead (ja le de `lead_field_values`)
