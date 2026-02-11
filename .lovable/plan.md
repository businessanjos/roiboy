

## Permitir notificacoes de auto-mencao

### Problema

Na linha 41 de `src/lib/mention-notifications.ts`, existe um filtro que exclui o proprio usuario da lista de notificacoes:

```
.filter((id) => id !== currentUser.id)
```

Isso impede que o usuario receba notificacao ao mencionar a si mesmo.

### Correcao

**Arquivo: `src/lib/mention-notifications.ts`**

Remover o filtro na linha 41, mudando de:

```
const userIdsToNotify = mentionedUsers
  .map((u) => u.id)
  .filter((id) => id !== currentUser.id);
```

Para:

```
const userIdsToNotify = mentionedUsers.map((u) => u.id);
```

Tambem remover a checagem `if (userIdsToNotify.length === 0) return;` na linha 43, pois a checagem ja existe na linha 36 (`mentionedUsers.length === 0`).

### Resultado esperado

Todos os usuarios mencionados -- inclusive o proprio autor -- receberao a notificacao de mencao normalmente.

