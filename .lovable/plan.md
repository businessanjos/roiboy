
## Corrigir "Apagar Mensagem Para Todos" no ROY zAPP

### Problema

A acao `delete_message` chamada pelo frontend nao existe no `uazapi-manager`. O codigo cai no `result = { success: true }` padrao sem nunca chamar a API do UAZAPI, por isso a mensagem e marcada como apagada localmente mas continua visivel no WhatsApp.

### Solucao

Adicionar o handler `delete_message` ao `uazapi-manager` que chama `POST /message/delete` com o body `{ id: messageId }`, conforme a documentacao da API.

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-manager/index.ts` | Adicionar handler para `action === "delete_message"` que chama o endpoint `/message/delete` da UAZAPI |

### Detalhes tecnicos

**1. uazapi-manager/index.ts**

- Adicionar `"delete_message"` a lista de `tokenRequiredActions` (linha 93)
- Adicionar novo bloco `else if (action === "delete_message")` antes do bloco final de retorno
- O handler vai:
  1. Extrair `message_id` do payload
  2. Validar que `message_id` esta presente
  3. Chamar `uazapiInstance("/message/delete", "POST", token!, { id: message_id })`
  4. Retornar `{ deleted: true }` em caso de sucesso

**2. RoyZapp.tsx (ajuste menor)**

- Atualizar a verificacao de sucesso na linha 2415 para verificar corretamente a resposta do novo handler (`data?.data?.deleted === true`)
- Nenhuma mudanca estrutural necessaria, pois o frontend ja envia os dados corretos

### Codigo do novo handler

```typescript
} else if (action === "delete_message") {
  const messageId = payload.message_id;
  if (!messageId) {
    return new Response(
      JSON.stringify({ error: "message_id é obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  result = await uazapiInstance("/message/delete", "POST", token!, { id: messageId });
  result = { deleted: true, api_response: result };
}
```

### Sobre mensagens apagadas pelo cliente

O webhook (`uazapi-webhook`) ja possui o handler para eventos `messages.delete` / `message.revoke` que marca mensagens como apagadas no banco. Esse fluxo ja funciona desde que o webhook esteja configurado com os eventos corretos (`messages.update` inclui updates de delete). A correcao necessaria e apenas no fluxo de saida (admin apagando mensagens).
