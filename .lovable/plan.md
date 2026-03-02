
## Adicionar preview de arquivo antes do envio no drag-and-drop

### Problema

Ao arrastar e soltar um video ou documento na barra de mensagem, o arquivo e enviado imediatamente sem mostrar um preview para confirmacao do usuario. O comportamento esperado e o mesmo das imagens: mostrar um preview e aguardar o usuario confirmar (Enter ou botao enviar).

### Abordagem

Reutilizar o mesmo padrao ja existente para preview de imagens, expandindo para suportar qualquer tipo de arquivo (video, documento).

### Alteracoes

**1. `src/components/royzapp/ZappMessageInput.tsx`**

- Adicionar nova prop `filePreview?: { file: File; url: string } | null` e `onSetFilePreview?: (preview: { file: File; url: string } | null) => void`
- No `handleDrop`, ao invez de chamar `onFileDrop` diretamente, chamar `onSetFilePreview` para mostrar o preview
- Adicionar UI de preview de arquivo (similar ao de imagem):
  - Videos: mostrar thumbnail com icone de play e nome do arquivo
  - Documentos: mostrar icone de documento e nome do arquivo
- Adicionar funcao `discardFilePreview` para descartar
- Botoes de descartar e enviar no preview (igual ao de imagem)

**2. `src/components/royzapp/ZappChatView.tsx`**

- Propagar as novas props `filePreview` e `onSetFilePreview` para o `ZappMessageInput`

**3. `src/pages/RoyZapp.tsx`**

- Adicionar estado `filePreview` com `useState`
- Implementar `onSetFilePreview` handler
- Remover o envio imediato do `onFileDrop` e substituir por setar o preview
- No `handleSendMessage` (ou equivalente), verificar se ha `filePreview` ativo e enviar o arquivo com deteccao de tipo (video/document) antes de limpar o preview
- Validar tamanho (50MB) ao setar o preview, nao no envio

### UI do preview de arquivo

```text
+----------------------------------------------+
| [icone]  nome_do_arquivo.mp4      [X] [Enviar]|
|          Video pronto para envio              |
+----------------------------------------------+
```

Para videos: icone de Play, texto "Video pronto para envio"
Para documentos: icone de FileText, texto "Documento pronto para envio"

### Resultado

Todos os tipos de arquivo arrastados e soltos mostrarao um preview com confirmacao antes do envio, consistente com o comportamento das imagens.
