
# Plano: Corrigir Notificações de Menções na Timeline do Cliente

## Problema Identificado

Os usuários mencionados com `@` na timeline do cliente **não estão recebendo notificações** porque:

1. A extração de nomes do texto (regex) **falha com nomes compostos** como "José da Paixão" - extrai apenas "José"
2. A busca no banco por nome exato não encontra "José", então zero notificações são criadas
3. O componente `MentionTextarea` já fornece os IDs dos usuários mencionados via callback `onMentionSelect`, mas a Timeline **não está usando esse callback**

## Solução Proposta

### Mudança 1: Capturar IDs diretamente do MentionTextarea

**Arquivo:** `src/components/client/Timeline.tsx`

Adicionar estado para armazenar os usuários mencionados:
```typescript
const [mentionedUsers, setMentionedUsers] = useState<{ id: string; name: string }[]>([]);
```

Conectar o callback `onMentionSelect` ao `MentionTextarea`:
```tsx
<MentionTextarea
  ...
  onMentionSelect={(users) => setMentionedUsers(users)}
/>
```

### Mudança 2: Refatorar a função de criar notificações

**Arquivo:** `src/components/client/Timeline.tsx`

Alterar `createNotificationsWithAnchor` para receber IDs em vez de nomes:
```typescript
const createNotificationsWithAnchor = async (
  mentionedUserIds: string[], // Agora recebe IDs!
  commentContent: string, 
  followupId: string
) => {
  // Remove self
  const userIdsToNotify = mentionedUserIds.filter(id => id !== currentUser.id);
  
  // Create notifications directly (sem buscar por nome)
  const notificationsToCreate = userIdsToNotify.map((userId) => ({
    account_id: currentUser.account_id!,
    user_id: userId,
    type: "mention",
    title: `${currentUser.name} mencionou você`,
    content: `Em ${clientName}: "${commentContent.slice(0, 100)}..."`,
    link: `/clients/${clientId}#comment-${followupId}`,
    triggered_by_user_id: currentUser.id,
    source_type: "client_followup",
    source_id: followupId,
  }));

  if (notificationsToCreate.length > 0) {
    await supabase.from("notifications").insert(notificationsToCreate);
  }
};
```

### Mudança 3: Atualizar handleSubmitComment para usar IDs

```typescript
const handleSubmitComment = async () => {
  // ... código existente ...
  
  // Usar mentionedUsers.map(u => u.id) em vez de extractMentions(comment)
  if (mentionedUsers.length > 0 && newFollowup) {
    await createNotificationsWithAnchor(
      mentionedUsers.map(u => u.id),
      comment.trim(), 
      newFollowup.id
    );
  }
  
  // Limpar menções após enviar
  setMentionedUsers([]);
  setComment("");
  // ...
};
```

### Mudança 4: Limpar menções ao limpar o campo

Quando o comentário for enviado ou o campo limpo, resetar `mentionedUsers`:
```typescript
setComment("");
setMentionedUsers([]); // Limpar lista de mencionados
```

## Benefícios

1. **100% de precisão**: Os IDs são capturados diretamente quando o usuário seleciona da lista, não há possibilidade de erro de regex
2. **Nomes compostos funcionam**: "José da Paixão", "Jessica Campos" - qualquer nome funciona
3. **Menos consultas ao banco**: Não precisa buscar IDs pelos nomes
4. **Notificações em tempo real**: O sistema já tem realtime configurado - assim que a notificação for inserida, o toast/popup aparecerá na tela do mencionado

## Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/components/client/Timeline.tsx` | Usar `onMentionSelect`, refatorar criação de notificações |

## Resultado Esperado

Após a implementação:
- Quando um usuário mencionar "@José da Paixão" na timeline
- José receberá instantaneamente:
  1. Um **toast** na parte inferior da tela
  2. Uma **notificação push do navegador** (se permitido)
  3. Um registro no **sino de notificações** do header
