

## Permitir arrastar e soltar qualquer tipo de arquivo no campo de mensagem

### Problema

O drag-and-drop no campo de mensagem do ROY zAPP aceita apenas imagens. Videos, PDFs, documentos e outros arquivos sao rejeitados silenciosamente ao serem soltos na area de input.

### Alteracoes

**1. `src/components/royzapp/ZappMessageInput.tsx`**

- Adicionar nova prop `onFileDrop?: (file: File) => void` na interface `ZappMessageInputProps`
- Modificar `handleDrop` para aceitar qualquer arquivo:
  - Imagens: manter comportamento atual (preview via `onSetImagePreview`)
  - Qualquer outro tipo (video, documento, etc): chamar `onFileDrop(file)`
- Atualizar o texto e icone do overlay de drop: trocar "Solte a imagem aqui" por "Solte o arquivo aqui" e usar icone generico (`Paperclip` ou `FileText`)

**2. `src/pages/RoyZapp.tsx`**

- Criar funcao `handleFileDrop` que recebe um `File`, valida tamanho (max 50MB), detecta tipo automaticamente (image/video/document) e chama `sendMediaMessage`
- Passar `onFileDrop={handleFileDrop}` para o `ZappMessageInput`

### Logica de deteccao de tipo no drop

```text
file.type.startsWith('image/')  -> preview de imagem (comportamento atual)
file.type.startsWith('video/')  -> sendMediaMessage(file, 'video')
qualquer outro                  -> sendMediaMessage(file, 'document')
```

### Resultado

Usuarios poderao arrastar e soltar qualquer tipo de arquivo (videos, PDFs, documentos, etc.) diretamente no campo de mensagem para envio rapido, sem precisar usar o botao de anexo.

