
## Corrigir Exibicao de Nome de Arquivo no ROY zAPP

### Problema Identificado

Ao enviar um documento pelo ROY zAPP, o arquivo eh armazenado no storage com um nome baseado em timestamp (ex: `1770666965443.xlsx`). Quando o WhatsApp ecoa a mensagem de volta via webhook, ele retorna esse nome numerico como `fileName` do documento. Se a deduplicacao falhar (nao encontrar o registro original do frontend), o webhook cria um NOVO registro na tabela `zapp_messages` com `media_filename = "1770666965443.xlsx"` em vez do nome original do arquivo.

**Evidencia do banco de dados:**
- `media_filename: 1770666965443.xlsx` (ERRADO - nome do storage)
- `media_filename: RM - Plano de acao - Jessica Quaquarini - 1 fase.pdf` (CORRETO - nome original)

### Solucao (2 pontos de correcao)

#### 1. Preservar nome original no upload ao storage

**Arquivo:** `src/pages/RoyZapp.tsx` (linha ~1990)

Atualmente:
```typescript
const fileName = `${currentUser!.account_id}/${Date.now()}.${fileExt}`;
```

Correcao - incluir o nome original sanitizado no path do storage:
```typescript
const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
const fileName = `${currentUser!.account_id}/${Date.now()}_${safeName}`;
```

Isso faz com que o WhatsApp receba e retorne um nome reconhecivel (ex: `1770666965443_Relatorio.xlsx`) em vez de apenas numeros.

#### 2. Proteger filename na deduplicacao do webhook

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (linha ~1327-1342)

Quando o webhook encontra um registro pendente (dedupe) para documentos, nao sobrescrever o `media_filename` existente. Se nao encontrar dedupe e inserir novo registro, dar preferencia ao nome original se disponivel.

Adicionar na logica de dedupe para documentos: ao atualizar o registro existente, preservar o `media_filename` que ja foi salvo pelo frontend.

Tambem, caso nao haja dedupe e o webhook insira um registro novo, derivar um nome melhor a partir da URL se `mediaFilename` for apenas numeros.

### Detalhes Tecnicos

**Alteracoes em `src/pages/RoyZapp.tsx`:**
- Sanitizar `file.name` e concatenar com o timestamp no path de upload
- Mesmo ajuste para o segundo bloco de envio de midia (~linha 2240 se existente)

**Alteracoes em `supabase/functions/uazapi-webhook/index.ts`:**
- No bloco de dedupe de documentos (linha 1327+), ao fazer update, nao incluir `media_filename` no `updateData` (ja esta correto, mas confirmar)
- Na insercao de mensagem nova (linha 1369), adicionar fallback: se `mediaFilename` parece ser apenas numeros (regex `/^\d+\.\w+$/`), tentar extrair nome melhor da URL ou manter o conteudo existente

### Impacto
- Arquivos enviados passarao a exibir o nome original tanto para o remetente quanto para o destinatario
- Nenhuma quebra de funcionalidade existente
- Retrocompativel com mensagens ja salvas
