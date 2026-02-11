

## Plano de Otimizacao Agressiva do uazapi-webhook

### Diagnostico: Queries por mensagem inbound (pior caso atual)

```text
QUERY #  | LINHA   | DESCRICAO                                    | PODE ELIMINAR?
---------|---------|----------------------------------------------|---------------
1        | 340-353 | Busca integracao (ate 5 tentativas!)          | Cachear
2        | 364-376 | Busca integracao por token (fallback)         | Cachear
3        | 387-398 | Busca integracao por owner (fallback)         | Cachear
4        | 439-446 | Busca departamento do setor                   | Cachear (ja tem cache)
5        | 479-484 | Dedup outbound echo (outbound only)           | OK
6        | 908/928 | Busca conversa existente                      | Cachear
7        | 938-948 | Fallback conversa legacy                      | Eliminar
8        | 973-980 | Fallback normalizacao BR                      | Eliminar
9        | 994-1000| Link cliente no fallback BR                   | Eliminar
10       | 1030-39 | Auto-unify legacy                             | Eliminar
11       | 1146-51 | Busca cliente (nova conversa)                 | Cachear
12       | 1121-24 | Update conversa existente                     | Manter
13       | 1170-95 | Insert nova conversa                          | Manter
14       | 1212-98 | Auto-suggest client links (setTimeout)        | Desacoplar
15       | 1320-27 | Dedup outbound (20 registros)                 | OK
16       | 1432-57 | Insert mensagem                               | Manter
17       | 1480-96 | Busca assignment                              | Cachear
18       | 1528-39 | Update assignment                             | Manter
19       | 1580-84 | Busca avatar cliente (client analysis)        | Eliminar
20       | 1610-16 | Busca conversa conversations (analysis)       | Eliminar
21       | 1621-30 | Insert conversa conversations                 | Eliminar
22       | 1638-48 | Insert message_event                          | Mover p/ queue
23       | 1658-63 | Re-busca mensagem inserida (para queue AI)    | Eliminar
24       | 1667-75 | Insert ai_analysis_queue                      | Mover p/ queue
25       | 1690-95 | Busca lead (se nao e cliente)                 | Cachear
26       | 1716-20 | Update conversa com lead_id                   | Manter
```

**Total pior caso: ~18-22 queries por mensagem inbound**
**Meta: reduzir para 4-6 queries**

---

### Otimizacoes (ordenadas por impacto)

#### 1. Cachear conversa em memoria (economia: ~3 queries/msg)

Criar um cache `conversationCache` (Map) com chave `phone+integrationId` ou `groupJid+integrationId`. Ao encontrar conversa na query principal (linha 908/928), cachear o resultado. Nas proximas mensagens do mesmo contato, pular a query e os 2 fallbacks (legacy + BR normalization).

- Cache TTL: 2 minutos (conversas mudam pouco)
- Invalidar ao criar nova conversa
- **Elimina queries 6, 7, 8, 9, 10** no caso cache-hit (~80% das mensagens)

#### 2. Mover client analysis inteiro para background (economia: ~6 queries/msg)

O bloco de "client analysis" (linhas 1572-1728) executa 6+ queries NO HOT PATH: busca avatar, busca/cria conversa `conversations`, insere `message_event`, re-busca mensagem, insere na `ai_analysis_queue`, busca lead. 

**Solucao**: Mover TUDO para um unico `setTimeout` fire-and-forget. No hot path, apenas inserir a mensagem e retornar resposta. O bloco async faz:
- Avatar update
- Conversations upsert
- message_event insert
- AI queue insert
- Lead lookup + link

Isso reduz o tempo de resposta do webhook de ~800ms para ~200ms.

#### 3. Eliminar fallbacks de busca de conversa para conversas existentes (economia: ~2 queries/msg)

Os fallbacks de "legacy conversation" (linha 937-960) e "phone normalization BR" (linha 968-1010) sao necessarios apenas para conversas MUITO antigas. A maioria ja foi migrada.

**Solucao**: 
- Rodar um script de migracao one-time que atribui `integration_id` a todas conversas legadas
- Apos migracao, remover os 2 blocos de fallback (queries 7, 8, 9)
- Manter apenas a query principal (query 6)

#### 4. Cachear assignment em memoria (economia: ~1 query/msg)

Criar cache `assignmentCache` com chave `conversationId`. Ao encontrar assignment (linha 1480-96), cachear. Nos proximos webhooks, pular a query se ja existe no cache.

- Cache TTL: 1 minuto
- Invalidar ao criar novo assignment

#### 5. Eliminar auto-unify legacy (economia: ~1 query/msg)

O bloco de auto-unify (linhas 1029-1061) busca duplicatas legadas. Apos a migracao do item 3, esse bloco se torna desnecessario.

#### 6. Retornar messageId do INSERT para evitar re-busca (economia: ~1 query/msg)

Na linha 1658-63, o webhook re-busca a mensagem que ACABOU de inserir para obter o ID. Modificar o INSERT original (linha 1432) para usar `.select('id')` e propagar o ID para o bloco de AI queue.

#### 7. Cachear client_id por phone (economia: ~1 query/msg para novas conversas)

O cache `clientPhoneCache` ja existe mas nao e usado no fluxo principal de criacao de conversa (linhas 1146-1151). Utilizar o cache existente.

---

### Resultado esperado

```text
ANTES (pior caso inbound):  18-22 queries
DEPOIS (caso tipico):        4-6 queries

Queries que sempre executam:
1. Busca integracao (cache hit = 0 queries)
2. Busca conversa (cache hit = 0 queries)  
3. Update conversa (last_message_at)
4. Insert mensagem
5. Busca/update assignment (cache hit = 0 queries)

Tudo mais vai para background ou e eliminado.
```

### Arquivos modificados

- `supabase/functions/uazapi-webhook/index.ts` - Todas as otimizacoes acima

### Riscos e mitigacoes

- **Cache stale**: TTL curto (1-2min) minimiza impacto. Conversas novas sempre fazem query.
- **Background errors**: setTimeout ja e fire-and-forget, erros nao afetam o webhook.
- **Remocao de fallbacks**: Depende de migracao previa. Se preferir nao migrar, os fallbacks podem ser mantidos mas com cache de conversa eles raramente executam.

