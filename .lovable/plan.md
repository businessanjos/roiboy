

## Relatório: Por que as notificações de menção ainda não funcionam

### Causa raiz encontrada

O componente **Timeline.tsx** (onde você está testando) **não usa** a função compartilhada `createMentionNotifications` que já foi corrigida. Ele possui sua **própria função interna** chamada `createNotificationsWithAnchor` (linha 836) que **ainda filtra auto-menções**:

```text
// Timeline.tsx, linha 841 - ESTE é o problema:
const userIdsToNotify = mentionedUserIds.filter((id) => id !== currentUser.id);
if (userIdsToNotify.length === 0) return;  // <- retorna sem criar nada
```

Ou seja: quando você menciona a si mesmo na Timeline, os IDs são filtrados, o array fica vazio, e a função retorna sem criar nenhuma notificação.

A correção anterior foi aplicada apenas em `src/lib/mention-notifications.ts`, mas o Timeline.tsx nunca importa nem usa esse arquivo.

### Plano de correção

**Arquivo: `src/components/client/Timeline.tsx`**

1. Remover o filtro de auto-menção na função `createNotificationsWithAnchor` (linha 841)
2. Remover a checagem `if (userIdsToNotify.length === 0) return;` (linha 843) que se torna redundante, pois a checagem já existe na linha 837

A mudança é de:
```text
const userIdsToNotify = mentionedUserIds.filter((id) => id !== currentUser.id);
if (userIdsToNotify.length === 0) return;
```

Para:
```text
const userIdsToNotify = mentionedUserIds;
```

Isso alinha o comportamento da Timeline com os outros componentes que já foram corrigidos, garantindo que todos os mencionados (incluindo o próprio autor) recebam a notificação.

