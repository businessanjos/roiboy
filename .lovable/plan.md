

## Plano: Corrigir suporte a múltiplos telefones de Leads

### Problema raiz

O campo `additional_phones` no banco armazena objetos `{number: "...", label: "..."}`, mas o hook `useLeads.tsx` define o tipo como `string[] | null` e faz cast direto (`as string[]`) sem normalizar. Isso faz com que:

1. **LeadsTab**: `handleOpenZappForLead` verifica `additionalPhones.length > 0` — isso funciona (o array não está vazio), mas os itens são objetos, não strings. O `getPhonePickerPhones` tenta tratar ambos os formatos, porém o tipo `Lead` diz `string[]`, mascarando o bug.

2. **RoyZapp busca**: O código de expansão no `searchContacts` está correto (trata objetos e strings), mas a query ao banco filtra apenas pela coluna `phone` (`phone.ilike.%...%`), nunca buscando em `additional_phones`. Leads encontrados por **nome** mostram os adicionais corretamente; leads encontrados por **telefone adicional** não aparecem porque o filtro SQL não inclui essa coluna. Porém, como `additional_phones` é JSONB, não dá para filtrar com `.ilike` — o filtro client-side após o fetch é a abordagem correta.

### Correções

**1. `src/hooks/useLeads.tsx`** — Normalizar `additional_phones` de objetos para strings

Na linha 134, em vez de `as string[]`, mapear cada item para extrair o valor string:
```typescript
additional_phones: Array.isArray(lead.additional_phones)
  ? (lead.additional_phones as any[]).map(p => 
      typeof p === 'object' && p !== null && p.number ? p.number : String(p)
    )
  : null,
```
Repetir nas linhas 180 (createLead) e em qualquer outro ponto que faça o mesmo cast.

**2. `src/pages/RoyZapp.tsx`** — Buscar mais leads para capturar telefones adicionais

O problema é que a query SQL filtra por `phone.ilike.%...%` e `additional_phones` é JSONB (não pesquisável com ilike). Solução: quando é busca por telefone, também buscar por nome e fazer filtro client-side. Alternativa mais simples: usar `additional_phones::text` como cast no RPC ou simplesmente aumentar o limite e buscar todos os leads que contenham o número no JSONB. 

Na verdade, a abordagem mais pragmática: adicionar um `.or()` extra com `additional_phones::text.ilike.%phone%` — Supabase PostgREST suporta isso com casting. Caso não funcione, a solução é usar uma busca textual.

Vou usar a abordagem: para buscas por telefone, adicionar o filtro `additional_phones::text` para capturar matches em telefones adicionais JSONB.

**3. `src/components/sales/LeadsTab.tsx`** — Após normalização no useLeads, o código existente já funciona

O `getPhonePickerPhones` já trata strings, e após a normalização no hook, os itens serão strings. Nenhuma mudança necessária aqui.

### Arquivos alterados
- `src/hooks/useLeads.tsx` — normalizar `additional_phones` de objetos para strings
- `src/pages/RoyZapp.tsx` — incluir busca em `additional_phones` (JSONB) para buscas por telefone

