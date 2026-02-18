
## Permitir iniciar conversa com numero novo no ROY zAPP

### Problema

O dialogo "Nova Conversa" busca apenas em registros existentes (clientes, leads, conversas). Se o numero nao existe em nenhuma dessas tabelas, o usuario ve "Nenhum contato encontrado" -- mesmo que seja um numero valido do WhatsApp. O WhatsApp nativo encontra porque valida direto no servidor, mas o ROY zAPP so busca no banco local.

### Solucao

Quando a busca retorna zero resultados e o termo digitado parece ser um numero de telefone valido, exibir uma opcao extra: "Iniciar conversa com +55 22 98117-3231". Ao clicar, o sistema cria a conversa normalmente usando a logica existente de `createConversationWithContact` com `type: 'conversation'`.

### Mudancas tecnicas

**Arquivo: `src/pages/RoyZapp.tsx`**

Na funcao `searchContacts` (linha ~3162-3228), apos combinar todos os resultados e verificar que `finalCombined` esta vazio:

1. Verificar se o termo de busca e um numero de telefone valido (comeca com `+` e tem pelo menos 10 digitos, ou e uma sequencia de digitos >= 10)
2. Normalizar o telefone para formato E.164 (garantir que comece com `+`)
3. Adicionar um contato sintetico na lista de resultados:
   ```
   {
     id: 'new-phone-' + normalizedPhone,
     full_name: normalizedPhone,  // Ex: "+5522981173231"
     phone_e164: normalizedPhone,
     avatar_url: null,
     type: 'conversation'
   }
   ```

Isso usa o fluxo existente de criacao de conversa sem vinculo a cliente/lead.

**Arquivo: `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx`**

Atualizar a mensagem de "Nenhum contato encontrado" para nao aparecer quando existe a opcao de novo numero. Nenhuma mudanca estrutural necessaria, pois o contato sintetico ja sera renderizado pela lista existente.

### Detalhes da implementacao

No `searchContacts`, apos a linha ~3174 onde `finalCombined` e calculado:

```typescript
// Se nao encontrou nenhum contato individual e a busca parece um telefone valido,
// oferecer opcao de iniciar conversa com esse numero
if (combined.length === 0 && groups.length === 0) {
  const phoneDigits = trimmedSearch.replace(/\D/g, '');
  if (phoneDigits.length >= 10) {
    const formattedPhone = trimmedSearch.startsWith('+') 
      ? trimmedSearch 
      : `+${phoneDigits}`;
    finalCombined.push({
      id: `new-phone-${phoneDigits}`,
      full_name: formattedPhone,
      phone_e164: formattedPhone,
      avatar_url: null,
      type: 'conversation' as const,
    });
  }
}
```

Nao e necessario mudar o `createConversationWithContact` pois ele ja suporta contatos do tipo `conversation` -- cria a zapp_conversation com o telefone e sem lead_id/client_id.

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/RoyZapp.tsx` | Adicionar logica de contato sintetico por telefone quando busca retorna vazia |
