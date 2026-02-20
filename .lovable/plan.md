
## Corrigir bugs no fluxo de solicitacao de acesso

### Problemas identificados

Tres bugs interligados impedem o funcionamento correto:

**Bug 1: Cleanup so roda no POST, mas visitante recusado nunca faz POST**
- Quando o visitante abre a pagina, o frontend faz um GET com o email salvo no localStorage (linha 198)
- O GET retorna `status: "rejected"` e o frontend mostra a tela "Acesso Recusado" permanentemente
- O cleanup de 30 minutos so roda no handler POST (linha 428), entao a entrada recusada nunca e removida

**Bug 2: Tela de "Acesso Recusado" nao permite re-solicitar**
- A tela rejeitada (linhas 344-355) nao tem nenhum botao para tentar novamente
- O email fica salvo no localStorage, entao ao recarregar a pagina, o fluxo automatico repete o GET e mostra "Recusado" novamente
- O usuario fica permanentemente bloqueado

**Bug 3: Erros do POST (429 rate limit) sao ignorados silenciosamente**
- `callEdge` retorna `res.json()` sem verificar o status HTTP (linha 162)
- Em `handleSubmit`, o codigo checa `data.status` (linhas 226-230), mas respostas de erro tem `data.error` e nao `data.status`
- Erros como "Aguarde 5 minutos" nunca sao exibidos ao usuario

### Solucao

#### 1. Edge Function `supabase/functions/shared-dashboard/index.ts` - Cleanup tambem no GET

Adicionar a mesma logica de cleanup no handler GET, antes de verificar o status da solicitacao. Quando o GET encontrar um registro recusado ou pendente com mais de 30 minutos, deleta-lo e retornar `status: "not_found"` para que o frontend mostre o formulario novamente.

```typescript
// No GET handler, apos encontrar o share e antes de checar access:
// Cleanup expired requests
await supabaseAdmin
  .from("insights_share_access_requests")
  .delete()
  .eq("share_id", share.id)
  .in("status", ["pending", "rejected"])
  .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());
```

#### 2. Frontend `SharedInsightsDashboard.tsx` - Botao "Tentar novamente" na tela rejeitada

Adicionar um botao na tela de "Acesso Recusado" que limpa o email do localStorage e volta para o formulario:

```typescript
if (state === "rejected") {
  return (
    // ... card existente ...
    <Button variant="outline" onClick={() => {
      localStorage.removeItem(`shared-dash-email-${token}`);
      setState("email_form");
    }}>
      Solicitar novamente
    </Button>
  );
}
```

#### 3. Frontend `SharedInsightsDashboard.tsx` - Tratar erros do POST

Em `handleSubmit`, verificar se a resposta contem `data.error` e exibir a mensagem ao usuario (incluindo o rate limit de 429):

```typescript
const data = await callEdge("POST", "", { share_token: token, email: email.trim() });
if (data.error) {
  setErrorMsg(data.error);
  // Manter no formulario para o usuario tentar novamente
  return;
}
```

Adicionar exibicao do `errorMsg` no formulario de email.

### Fluxo corrigido

1. Visitante acessa link -> GET verifica status
2. Se rejeitado ha mais de 30 min -> cleanup deleta a entrada -> retorna "not_found" -> mostra formulario
3. Se rejeitado ha menos de 30 min -> mostra tela "Recusado" com botao "Solicitar novamente"
4. Visitante clica "Solicitar novamente" -> volta ao formulario
5. Visitante envia email (POST) -> cleanup roda -> rate limit checado -> se < 5 min, erro exibido no formulario
6. Apos 5 min -> re-solicitacao aceita, contador incrementado
