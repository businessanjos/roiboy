---
name: leads/deal-mirrored-fields-pt
description: O LeadDetailSheet espelha "Item da Venda" e "Origem da Venda" do deal mais recente do lead, resolvendo IDs de campo dinamicamente por NOME (nunca por UUID hardcoded) para sobreviver a renomeações/recriações.
type: feature
---

No componente `LeadDetailSheet.tsx`, os campos "Item da Venda" e "Origem da Venda" são campos de **Deal** (`show_in_deals: true`, `show_in_leads: false`) e não existem em `lead_field_values`. Para exibi-los no card do lead:

1. **Resolução dinâmica por NOME**: Os IDs dos campos são buscados em runtime via `custom_fields.name IN ('Item da Venda', 'Origem da Venda')` com `show_in_deals = true` e `is_active = true`. Nunca usar UUIDs hardcoded — eles quebram silenciosamente se o campo for recriado.

2. **Fallback por múltiplos deals**: A busca percorre todos os deals do lead (ordenados por `created_at DESC`) e usa o primeiro deal que tenha valor preenchido para cada campo. Isso evita exibir vazio quando o deal mais recente não tem o dado mas um anterior tem.

3. **Resolução de valor**:
   - Se o `value_text` for um UUID, busca o nome em `products`.
   - Senão, procura o `label` em `custom_fields.options` pelo `value`.
   - Fallback final: exibe o valor bruto.

4. **UI**: Renderizado como badges read-only (Package + Tag) no header do sheet. Só aparece se houver valor.
