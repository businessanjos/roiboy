

## Plano: Corrigir erro de renderização de `additional_phones`

### Problema

O campo `additional_phones` no banco de dados armazena objetos `{number: "..."}` e não strings simples. Em `LeadDetailSheet.tsx`, o código trata `additional_phones` como `string[]` e renderiza cada item diretamente com `{phone}`, causando o erro "Objects are not valid as a React child (found: object with keys {number})".

### Correção

**Arquivo: `src/components/leads/LeadDetailSheet.tsx`**

1. Atualizar a interface `Lead` — mudar `additional_phones` de `string[] | null` para `Array<{number: string} | string> | null`
2. Na linha 192, ao processar `leadData.additional_phones`, normalizar os itens para extrair o valor string (se for objeto, usar `.number`; se for string, manter)
3. Na linha 299, onde renderiza `{phone}` — extrair o valor correto: `typeof phone === 'object' ? phone.number : phone`

Também verificar se o mesmo problema existe em `LeadsTab.tsx` (onde o `ZappLeadPhonePickerDialog` recebe os telefones adicionais).

