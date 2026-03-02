

## Corrigir envio de video como documento no Playbook

### Problema

Quando um video e enviado pelo Playbook, ele chega ao WhatsApp como um documento para download em vez de ser exibido como video reproduzivel. Isso acontece por dois motivos:

1. No handler do Playbook (linha 4694), videos sao enviados com tipo `'document'` hardcoded, independente do tipo real
2. A funcao `sendMediaMessage` so aceita `"image" | "document"` como tipos, nao tem suporte a `"video"`

O resultado e que a UAZAPI recebe `type: "document"` e envia o arquivo como anexo, nao como midia reproduzivel.

### Alteracoes

Todas no arquivo `src/pages/RoyZapp.tsx`:

**1. Expandir `sendMediaMessage` para suportar tipo "video" (linha 1962)**

- Alterar a assinatura de `mediaType: "image" | "document"` para `mediaType: "image" | "document" | "video"`
- Atualizar a mensagem optimistica para tratar video (preview com emoji de camera de video)
- Atualizar o preview da conversa para videos: `"🎬 Video"` em vez de `"📎 arquivo.mp4"`
- Atualizar o toast de sucesso para videos

**2. Corrigir o handler do Playbook para enviar videos com o tipo correto (linha 4694)**

- Mudar `sendMediaMessage(file, 'document', ...)` para `sendMediaMessage(file, 'video', ...)` quando `item.content_type === 'video'`
- Manter `'document'` apenas para itens de tipo documento

**3. Corrigir deteccao de tipo no file select (linhas 2088-2098)**

- Adicionar logica para detectar videos pelo MIME type do arquivo (`file.type.startsWith('video/')`) e enviar como `"video"` automaticamente, em vez de sempre enviar como `"document"`

### Resultado

- Videos enviados pelo Playbook chegarao ao WhatsApp como midia reproduzivel
- Videos enviados por upload direto tambem serao detectados e enviados corretamente
- No ROY zAPP, o video aparecera com player de video (ja suportado pelo ZappMessageBubble, linha 497)
- Documentos continuarao sendo enviados como documentos normalmente
