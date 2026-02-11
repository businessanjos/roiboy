
## Corrigir notificacoes de mencao (@) em todos os componentes

### Problema identificado

Apos investigacao, apenas **1 de 5 componentes** que permitem mencoes com "@" realmente cria notificacoes. O componente `Timeline.tsx` funciona corretamente, mas os seguintes **nao criam notificacoes**:

1. **ClientFollowup.tsx** - Notas e respostas na aba "Acompanhamento" do cliente
2. **SalesPerformance.tsx** - Notas na aba de vendas do cliente
3. **ClientFinancial.tsx** - Notas na aba financeira do cliente
4. **FinancialQuickNoteInput.tsx** - Input de nota financeira rapida

Nesses componentes, o usuario pode digitar "@Fulano" e selecionar a pessoa, mas nenhuma notificacao e criada -- os IDs dos usuarios mencionados simplesmente nao sao rastreados nem enviados ao banco.

### Causa raiz

Os componentes usam `MentionInput` ou `MentionTextarea` mas **nao passam a prop `onMentionSelect`**, entao os IDs dos usuarios mencionados sao descartados. Alem disso, nao ha logica para inserir registros na tabela `notifications` apos o envio do comentario.

### Solucao

Para cada componente afetado:

1. Adicionar estado `mentionedUsers` para rastrear usuarios mencionados
2. Passar `onMentionSelect` ao `MentionInput`/`MentionTextarea`
3. Apos inserir o comentario no banco, criar notificacoes para os usuarios mencionados (mesmo padrao do `Timeline.tsx`)
4. Limpar `mentionedUsers` apos o envio

### Detalhes tecnicos por arquivo

**1. `src/components/client/ClientFollowup.tsx`**
- Adicionar `useState` para `mentionedUsers`
- Passar `onMentionSelect={setMentionedUsers}` nos dois `MentionInput` (nota rapida e resposta)
- No `handleQuickComment`: apos inserir followup, criar notificacoes com link `/clients/{clientId}`
- No `handleReply`: mesma logica de notificacao
- Modificar os inserts para usar `.select("id").single()` para obter o ID do followup criado (necessario para o link)

**2. `src/components/client/SalesPerformance.tsx`**
- Adicionar estado `mentionedUsers`
- Passar `onMentionSelect` ao `MentionInput`
- Apos inserir nota, criar notificacoes com link para a aba de vendas do cliente

**3. `src/components/client/ClientFinancial.tsx`**
- Adicionar estado `mentionedUsers`
- Passar `onMentionSelect` ao `MentionInput`
- Apos inserir nota, criar notificacoes com link para a aba financeira do cliente

**4. `src/components/client/FinancialQuickNoteInput.tsx`**
- Adicionar estado `mentionedUsers`
- Passar `onMentionSelect` ao `MentionTextarea`
- Apos inserir nota, criar notificacoes com link para a aba financeira do cliente

### Logica de criacao de notificacao (reutilizada)

Para evitar duplicacao, sera criada uma funcao utilitaria compartilhada:

```text
src/lib/mention-notifications.ts

Funcao: createMentionNotifications({
  supabase, mentionedUserIds, currentUser, 
  commentContent, followupId, clientId, clientName, linkPath
})
- Filtra o proprio usuario da lista
- Cria registros na tabela notifications com:
  - type: "mention"
  - title: "{nome} mencionou voce"
  - content: trecho do comentario
  - link: caminho para o comentario especifico
  - triggered_by_user_id: usuario atual
```

### Resultado esperado

Ao mencionar "@Fulano" em qualquer campo de comentario do sistema (timeline, acompanhamento, vendas, financeiro), o usuario mencionado recebera:
- Um toast em tempo real (se estiver online)
- Uma notificacao push no navegador (se habilitada)
- Uma entrada na aba Notificacoes com link clicavel que redireciona ao local exato da mencao
