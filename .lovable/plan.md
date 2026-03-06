

## Plano: Corrigir múltiplos telefones — Leads.tsx e busca RoyZapp

### Problemas identificados

**1. Página `/leads` (Leads.tsx) não tem phone picker**
O botão "Abrir Conversa no ROY zAPP" na página `/leads` chama `openZappConversation` diretamente com `lead.phone` (linhas 1296 e 1320). Não existe nenhuma lógica de verificação de `additional_phones` nem o `ZappLeadPhonePickerDialog` nesta página. A correção anterior só foi aplicada em `LeadsTab.tsx` (setor Vendas do Pipeline), mas o usuário está na página `/leads`.

**2. Busca no ROY zAPP retorna poucos resultados**
O filtro `additional_phones::text.ilike.%...%` adicionado na query PostgREST provavelmente está causando erro ou comportamento inesperado, pois PostgREST não suporta casting de tipos (`::text`) diretamente nos filtros `.or()`. Isso faz a query de leads falhar silenciosamente ou retornar resultados incorretos.

### Correções

**Arquivo: `src/pages/Leads.tsx`**

1. Importar `ZappLeadPhonePickerDialog`
2. Adicionar estados `phonePickerOpen` e `phonePickerLead`
3. Criar `handleOpenZappForLead` — mesma lógica do LeadsTab: verificar se `additional_phones.length > 0`, se sim abrir picker, se não ir direto
4. Criar `getPhonePickerPhones` — montar lista de telefones (principal + adicionais)
5. Substituir as duas chamadas diretas de `openZappConversation` (linhas 1296 e 1320) por `handleOpenZappForLead(lead)`
6. Renderizar `ZappLeadPhonePickerDialog` no final do componente

**Arquivo: `src/pages/RoyZapp.tsx`**

1. Remover `additional_phones::text.ilike.%...%` do filtro `.or()` da query de leads (linhas 3093-3095)
2. Manter a query buscando apenas por `full_name` e `phone` (como era antes)
3. Manter o `additional_phones` no `select` para que a expansão client-side continue funcionando
4. Para capturar leads por telefone adicional: fazer uma segunda query separada buscando no JSONB com `additional_phones.cs.[{"number":"..."}]` ou simplesmente buscar todos os leads por nome e expandir client-side (abordagem mais segura)

A abordagem mais confiável: remover o cast do filtro SQL, voltar ao filtro original (`full_name.ilike` + `phone.ilike`), e aumentar o limit de 10 para 20 para compensar. Os telefones adicionais já são expandidos client-side após o fetch.

### Arquivos alterados
- `src/pages/Leads.tsx` — adicionar phone picker (import, estados, handler, renderização)
- `src/pages/RoyZapp.tsx` — remover `additional_phones::text` do filtro `.or()`, restaurar filtro original

