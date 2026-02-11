

## Mover auto-suggest e client analysis para fila assincrona

### Objetivo

Eliminar todos os `setTimeout` do webhook e substituir por insercoes na fila `ai_analysis_queue`, processadas em batch pelo `process-ai-queue`. Isso reduz a carga do webhook a apenas INSERT de mensagem + INSERT na fila.

### Mudancas necessarias

#### 1. Migracao de banco: adicionar coluna `job_type` na `ai_analysis_queue`

Adicionar coluna `job_type TEXT NOT NULL DEFAULT 'ai_analysis'` para distinguir os tipos de job:
- `ai_analysis` - comportamento atual (chamar analyze-message)
- `client_analysis` - avatar update, conversations upsert, message_events, lead lookup
- `client_suggest` - auto-suggest client links

Adicionar coluna `payload JSONB` para dados extras que cada tipo de job precisa (phone, profile_pic_url, contact_name, chat_id, content, timestamp, etc).

```text
ALTER TABLE ai_analysis_queue
  ADD COLUMN job_type TEXT NOT NULL DEFAULT 'ai_analysis',
  ADD COLUMN payload JSONB;
```

#### 2. Webhook: substituir setTimeout por insercoes na fila

**Auto-suggest client links (linhas 1185-1278)**: Remover o bloco `setTimeout` inteiro. Substituir por um unico INSERT na `ai_analysis_queue` com `job_type = 'client_suggest'` e payload contendo `{ contact_name, phone, zapp_conversation_id }`.

**Client analysis (linhas 1555-1671)**: Remover o bloco `setTimeout` inteiro. Substituir por um unico INSERT na `ai_analysis_queue` com `job_type = 'client_analysis'` e payload contendo `{ linked_client_id, phone, profile_pic_url, chat_id, content, timestamp, zapp_conversation_id, inserted_message_id }`.

O webhook passa a ter ZERO setTimeouts - apenas queries sincronas essenciais.

#### 3. process-ai-queue: processar os 3 tipos de job

Refatorar o loop de processamento para despachar por `job_type`:

- **`ai_analysis`** (comportamento atual): busca mensagem, chama analyze-message. Sem mudanca.
- **`client_analysis`**: executa a logica que estava no setTimeout do webhook:
  - Se tem `client_id`: avatar update, conversations upsert, message_events insert, AI queue insert (cria sub-job de ai_analysis)
  - Se nao tem `client_id`: lead lookup, avatar update, link lead a conversa
- **`client_suggest`**: executa a logica de auto-suggest:
  - Busca clientes por nome parcial
  - Busca clientes por telefone parcial
  - Insere sugestoes na `zapp_client_suggestions`

Adicionar `job_type` ao SELECT da fila e fazer switch/case no processamento.

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/uazapi-webhook/index.ts` | Remover 2 blocos setTimeout (~120 linhas), adicionar 2 INSERTs na fila (~20 linhas) |
| `supabase/functions/process-ai-queue/index.ts` | Adicionar handlers para `client_analysis` e `client_suggest` (~150 linhas) |

### Resultado esperado

- Webhook: 0 setTimeouts, 0 queries de background. Apenas hot path sincronas + 1-2 INSERTs na fila.
- Toda logica pesada e processada em batch pelo cron, fora do hot path do webhook.
- Reduz tempo de resposta do webhook de ~200ms para ~100ms.
- Consolida todo processamento async em um unico ponto (process-ai-queue), facilitando monitoramento e debug.

