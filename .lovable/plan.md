
## Corrigir gravacao de campos select na edge function create-lead

### Problema
Os campos MQL e Canal sao do tipo **select** (selecao de opcoes). O sistema espera que o valor gravado em `value_text` seja o **ID interno da opcao** (ex: `opt_1`, `opt_2`), nao o **texto do label** (ex: "SIM - Acima de 30k").

A edge function esta gravando o texto do label, por isso a UI nao reconhece o valor e exibe "---".

O campo Faturamento Atual funciona porque e do tipo **text**, que aceita texto livre.

### Mapeamento das opcoes

**MQL (select):**
- "SIM - Acima de 30k" → `opt_1`
- "NAO - Abaixo de 30k" → `opt_2`

**Canal (select):**
- "Organico" → `opt_1`
- "Trafego Pago" → `opt_2`
- "Indicacao" → `opt_1770990177251`
- "Prospeccao ativa" → `opt_1770990180958`
- "Trafego Alheio" → `opt_1770990186415`
- "Esteira / Carteira" → `opt_1770990194848`
- "Social Seller" → `opt_1770990199860`
- "Recorrencia" → `opt_1770990203418`

### Solucao

**Arquivo: `supabase/functions/create-lead/index.ts`**

Apos criar o lead e antes de inserir em `lead_field_values`, buscar a definicao dos campos personalizados no banco para obter as opcoes. Para campos do tipo `select`, converter o texto recebido (label) para o ID da opcao (`value`), fazendo match case-insensitive e com normalizacao de acentos.

```text
// 1. Buscar definicao dos custom fields
const { data: customFields } = await supabase
  .from('custom_fields')
  .select('id, field_type, options')
  .in('id', [fieldIds...]);

// 2. Para cada campo, se for select, buscar o option.value pelo label
function resolveSelectValue(fieldDef, rawText) {
  if (fieldDef.field_type !== 'select') return rawText;
  const normalized = rawText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = fieldDef.options.find(opt =>
    opt.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalized
  );
  return match ? match.value : null; // null se nao encontrar
}
```

### O que nao muda
- JSON do n8n (continua enviando texto legivel como "Trafego Pago")
- UI do Lead (ja sabe ler opt_1, opt_2 etc)
- Faturamento Atual (continua sendo texto livre)
