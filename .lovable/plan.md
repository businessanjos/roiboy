

## Permitir comentario junto ao anexo de imagem/arquivo na Timeline

### Problema atual

Quando o usuario anexa uma imagem (pelo botao de camera, paste ou drag-and-drop) ou um arquivo (pelo botao de clipe), o envio e imediato e o campo `content` e salvo como `null`. Isso forca o usuario a enviar o comentario como uma mensagem separada.

### O que sera feito

Unificar o fluxo para que, ao selecionar qualquer arquivo (imagem ou documento), ele apareca como preview acima do campo de texto, permitindo que o usuario escreva um comentario opcional antes de clicar em Enviar. O comentario sera salvo junto com o arquivo no mesmo registro da timeline.

### Mudancas no fluxo

```text
ANTES:
  Clica em Camera/Clipe → Upload imediato (sem comentario)
  Cola/Arrasta imagem → Preview → Envia (sem comentario)

DEPOIS:
  Clica em Camera/Clipe → Preview do arquivo aparece acima do textarea
  Cola/Arrasta imagem → Preview da imagem aparece acima do textarea
  Usuario pode digitar um comentario no textarea (opcional)
  Clica em Enviar → Arquivo + comentario sao salvos juntos
```

### Detalhes tecnicos

**Arquivo: `src/components/client/Timeline.tsx`**

1. **Expandir o estado de preview** para suportar tanto imagens quanto arquivos:
   - Renomear/expandir `pastedImagePreview` para `filePreview` com tipo `{ file: File; url: string; type: "image" | "file" }`
   - Imagens mostram thumbnail, arquivos mostram icone + nome

2. **Alterar `handleFileSelect`** (botao camera/clipe):
   - Em vez de fazer upload imediato, setar o `filePreview` com o arquivo selecionado
   - O usuario pode entao digitar um comentario no textarea

3. **Alterar `sendPastedImage` → `sendFileWithComment`**:
   - Fazer upload do arquivo do `filePreview`
   - Inserir no `client_followups` com:
     - `content: comment.trim() || null` (comentario opcional)
     - `file_url`, `file_name`, `file_size` do arquivo
     - `type`: "image" ou "file" conforme o tipo do preview
   - Limpar tanto o `filePreview` quanto o `comment` apos envio

4. **Atualizar a UI de preview** (aparece em dois lugares no codigo, linhas ~1186-1217 e ~1365-1396):
   - Manter o layout atual de preview mas adaptar para mostrar tambem arquivos (nao apenas imagens)
   - Arquivos: exibir icone de documento + nome do arquivo
   - Imagens: manter thumbnail como esta

5. **Ajustar o botao de Enviar**:
   - Quando ha um `filePreview` ativo, o botao de Enviar do textarea deve chamar `sendFileWithComment` (nao `handleSubmitComment`)
   - Quando nao ha preview, manter o comportamento atual de enviar somente texto

6. **Ajustar Enter para envio**:
   - Se ha `filePreview`, Enter envia o arquivo com comentario
   - Se nao ha, Enter envia comentario de texto normalmente

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/client/Timeline.tsx` | Unificar fluxo de upload com comentario opcional, expandir preview para arquivos, ajustar logica de envio |

