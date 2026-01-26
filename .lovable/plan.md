
# Plano: Corrigir Bug de Duplicação ao Editar Mensagem

## Diagnóstico do Problema

A imagem mostra claramente o bug: uma mensagem foi editada (marcada "editado" às 16:47) e uma cópia idêntica apareceu logo abaixo (16:48).

### Causa Raiz Identificada

O problema está no arquivo `supabase/functions/uazapi-webhook/index.ts` nas linhas 1222-1238:

| Comportamento Atual | Problema |
|---------------------|----------|
| Webhook recebe notificação de mensagem | - |
| Busca mensagem por `external_message_id` | - |
| Se existe, verifica se foi deletada | - |
| Se foi deletada, retorna `ignored` | Correto |
| Se NÃO foi deletada, continua o fluxo... | **BUG!** Deveria retornar aqui |
| Entra no bloco de inserção (linha 1307) | Cria duplicata |

```text
// Fluxo atual com bug:
if (existingMsg) {
  // Verifica is_deleted
  if (msgDetails?.is_deleted) {
    return { ignored: true }; // OK
  }
  // FALTA UM RETURN AQUI! O código continua...
} else {
  // Bloco de deduplicação e insert
}
// insert() na linha 1307 executa mesmo quando existingMsg existe!
```

### Por que acontece ao editar?

1. Usuário edita mensagem no frontend
2. `handleEditMessage` atualiza o banco (`is_edited: true`, novo conteúdo)
3. `handleEditMessage` chama UAZAPI para editar no WhatsApp
4. UAZAPI envia webhook de confirmação com o mesmo `external_message_id`
5. Webhook encontra mensagem existente, mas **não retorna**
6. Webhook insere nova mensagem (duplicata)
7. Realtime `INSERT` dispara e adiciona duplicata na tela

---

## Solucao Proposta

### Correcao 1: Retornar Early quando Mensagem Existe (Principal)

Modificar o webhook para retornar imediatamente quando encontrar uma mensagem existente que nao foi deletada:

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts`

**Linha 1238:** Adicionar `return` apos verificar que mensagem existe e nao foi deletada:

```typescript
// ANTES (bugado):
if (existingMsg) {
  console.log(`Message already exists with external_message_id ${messageId}, checking if deleted`);
  
  const { data: msgDetails } = await supabase
    .from("zapp_messages")
    .select("is_deleted")
    .eq("id", existingMsg.id)
    .maybeSingle();
  
  if (msgDetails?.is_deleted) {
    console.log(`Message ${messageId} is deleted, ignoring webhook update`);
    return new Response(
      JSON.stringify({ ignored: true, reason: "message_deleted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // BUG: Nao tem return aqui!
} else {
  // ...
}

// DEPOIS (corrigido):
if (existingMsg) {
  console.log(`Message already exists with external_message_id ${messageId}, checking if deleted`);
  
  const { data: msgDetails } = await supabase
    .from("zapp_messages")
    .select("is_deleted, content, is_edited")
    .eq("id", existingMsg.id)
    .maybeSingle();
  
  if (msgDetails?.is_deleted) {
    console.log(`Message ${messageId} is deleted, ignoring webhook update`);
    return new Response(
      JSON.stringify({ ignored: true, reason: "message_deleted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // CORRECAO: Se mensagem existe e nao foi deletada, apenas ignorar
  // Isso evita duplicacao em caso de webhooks de edicao ou reprocessamento
  console.log(`Message ${messageId} already exists and is not deleted, skipping insert`);
  
  // Pular o insert e continuar para atualizar assignment/status se necessario
  // Mas NAO inserir nova mensagem
  
  // Continuar para atualizar assignment se necessario (abaixo do bloco de insert)
  // Usando uma flag para indicar que deve pular o insert
} else {
  // ... logica de deduplicacao normal
}
```

### Correcao 2: Usar Flag para Pular Insert

Adicionar uma flag `skipInsert` que sera `true` quando mensagem ja existe:

```typescript
// No inicio do bloco de verificacao:
let skipInsert = false;

if (existingMsg) {
  console.log(`Message already exists with external_message_id ${messageId}`);
  
  const { data: msgDetails } = await supabase
    .from("zapp_messages")
    .select("is_deleted")
    .eq("id", existingMsg.id)
    .maybeSingle();
  
  if (msgDetails?.is_deleted) {
    console.log(`Message ${messageId} is deleted, ignoring webhook`);
    return new Response(
      JSON.stringify({ ignored: true, reason: "message_deleted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  // CORRECAO: Mensagem existe, apenas pular insert
  console.log(`[DEDUPE] Message ${messageId} exists, skipping insert`);
  skipInsert = true;
} else {
  // ... logica de deduplicacao normal que tambem pode setar skipInsert
}

// Na linha 1306, onde ocorre o insert:
if (!isDuplicate && !skipInsert) {
  const { error: zappMsgError } = await supabase
    .from("zapp_messages")
    .insert({ ... });
}
```

### Correcao 3: Verificacao Adicional no Realtime (Blindagem Extra)

Adicionar verificacao de `is_edited` no listener de INSERT para prevenir duplicatas de mensagens editadas:

**Arquivo:** `src/pages/RoyZapp.tsx`

**Linha 643-648:** Melhorar verificacao de duplicatas:

```typescript
setMessages(prev => {
  // Verificar se ja existe por id OU external_message_id
  const exists = prev.some(m => 
    m.id === newMsg.id || 
    (m.external_message_id && m.external_message_id === newMsg.external_message_id)
  );
  
  // NOVO: Se a mensagem existente foi editada, ignorar INSERT
  if (exists) {
    const existingEdited = prev.find(m => 
      m.external_message_id === newMsg.external_message_id && m.is_edited
    );
    if (existingEdited) {
      console.log("[RoyZapp] Ignoring INSERT for edited message:", newMsg.id);
    }
    return prev;
  }
  
  // ... resto do codigo
});
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar flag `skipInsert` e return early quando mensagem existe |
| `src/pages/RoyZapp.tsx` | Melhorar verificacao de duplicatas no listener de INSERT |

---

## Fluxo Corrigido

```text
ANTES (bugado):
┌─────────────────────────────────────────────────────────┐
│ Webhook recebe notificacao                               │
│ ↓                                                       │
│ Busca por external_message_id → Encontra!               │
│ ↓                                                       │
│ Verifica is_deleted → Nao deletada                      │
│ ↓                                                       │
│ [Continua sem return]                                   │
│ ↓                                                       │
│ INSERT nova mensagem → DUPLICATA!                       │
└─────────────────────────────────────────────────────────┘

DEPOIS (corrigido):
┌─────────────────────────────────────────────────────────┐
│ Webhook recebe notificacao                               │
│ ↓                                                       │
│ Busca por external_message_id → Encontra!               │
│ ↓                                                       │
│ Verifica is_deleted → Nao deletada                      │
│ ↓                                                       │
│ skipInsert = true                                       │
│ ↓                                                       │
│ [Pula INSERT, apenas atualiza assignment]               │
│ ↓                                                       │
│ Return success (sem duplicata)                          │
└─────────────────────────────────────────────────────────┘
```

---

## Detalhes Tecnicos

### Por que usar flag em vez de return early?

O webhook precisa continuar executando apos a verificacao de duplicatas para:
1. Atualizar o `zapp_conversation_assignments` (status, department)
2. Processar outras logicas de conversacao

Se fizermos `return` imediatamente, perdemos essas atualizacoes importantes. Por isso a solucao usa uma flag `skipInsert` que permite pular apenas o insert, mas continuar o resto do fluxo.

### Cenarios cobertos pela correcao

| Cenario | Antes | Depois |
|---------|-------|--------|
| Usuario edita mensagem | Duplicata criada | Ignorado, sem duplicata |
| Webhook reprocessado | Duplicata criada | Ignorado, sem duplicata |
| Mensagem deletada | Corretamente ignorada | Corretamente ignorada |
| Mensagem nova | Inserida corretamente | Inserida corretamente |
