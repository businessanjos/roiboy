

## Variáveis do Playbook não substituídas em legendas de mídia

### Problema identificado

Quando um item do Playbook é do tipo **imagem, vídeo ou documento** com uma legenda (`media_caption`) que contém variáveis como `{{primeiro_nome}}`, o sistema envia a legenda **sem processar as variáveis**.

O `replaceVariables` só é chamado para `text_content` (itens de texto puro). Para itens de mídia, o `media_caption` é enviado diretamente, sem substituição.

**Código atual (RoyZapp.tsx, linhas 4682-4716):**
- Imagem: `caption: item.media_caption` → sem `replaceVariables`
- Vídeo/Documento: `item.media_caption` → sem `replaceVariables`

### Correção

No callback `onUseItem` do `PlaybookDialog` em `RoyZapp.tsx`, aplicar `replaceVariables` no `media_caption` antes de usá-lo:

1. **Extrair as variáveis** uma vez no início do callback (usando o mesmo `extractPlaybookVariables` já disponível)
2. **Para imagens (linha ~4683)**: processar `item.media_caption` com `replaceVariables` antes de passar para `setImagePreview`
3. **Para vídeos/documentos (linha ~4716)**: processar `item.media_caption` com `replaceVariables` antes de passar para `sendMediaMessage`

Também preciso importar/usar o `replaceVariables` do hook `usePlaybook` no escopo do callback. Como o callback já recebe `processedText` (texto processado pelo PlaybookDialog), a solução mais limpa é fazer o `PlaybookDialog` processar TAMBÉM o `media_caption` e passá-lo como parâmetro adicional no `onUseItem`.

### Alterações

**Arquivo: `src/components/sales/PlaybookDialog.tsx`**
- No `handleUseItem`, processar também `item.media_caption` com `replaceVariables`
- Alterar a interface do `onUseItem` para aceitar um terceiro parâmetro: `processedCaption`

**Arquivo: `src/pages/RoyZapp.tsx`**
- No callback `onUseItem`, usar `processedCaption` ao invés de `item.media_caption` para imagens, vídeos e documentos

