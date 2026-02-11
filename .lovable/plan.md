

## Corrigir regex que limpa menções com caracteres acentuados

### Problema encontrado

A causa raiz do problema **não está na lógica de notificação** (que está correta), mas sim nos componentes `MentionInput` e `MentionTextarea`.

Ambos possuem um `useEffect` que monitora mudanças no `value` e usa uma regex para detectar menções:

```
const mentions = value.match(/@(\w+(?:\s\w+)*)/g) || [];
```

O problema: `\w` em JavaScript **não reconhece caracteres acentuados** como `ã`, `é`, `ç`, etc. Então, quando o usuário menciona "@João Ferrari", a regex não encontra nenhuma menção, o `useEffect` interpreta que não há menções no texto e **limpa o array `mentionedUsers`** — zerando tudo antes do envio.

**Sequência do bug:**
1. Usuário seleciona "@João Ferrari" no dropdown -> `mentionedUsers` é preenchido corretamente
2. O `value` muda -> o `useEffect` dispara -> regex falha em reconhecer "João" -> `mentionedUsers` é resetado para `[]`
3. Usuário envia -> `mentionedUsers.length === 0` -> nenhuma notificação é criada

### Correção

**Arquivos a modificar:**
1. `src/components/ui/mention-input.tsx` (linha 130)
2. `src/components/ui/mention-textarea.tsx` (linha 165)

**Mudança em ambos:** Trocar a regex de:
```
/@(\w+(?:\s\w+)*)/g
```

Para uma que suporte caracteres Unicode/acentuados:
```
/@([\p{L}\p{N}_]+(?:\s[\p{L}\p{N}_]+)*)/gu
```

- `\p{L}` reconhece qualquer letra Unicode (incluindo acentuadas: ã, é, ç, ñ, etc.)
- `\p{N}` reconhece qualquer dígito Unicode
- Flag `u` habilita suporte a Unicode

### Resultado esperado

Após a correção, menções a nomes com acentos (como "João", "André", "José") serão reconhecidas pela regex. O `useEffect` não limpará mais o array indevidamente, e as notificações serão criadas normalmente ao enviar o comentário.
