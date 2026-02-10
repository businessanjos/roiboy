
## Diagnostico: Conversas Reabertas na Aba "Minhas"

### Causa Raiz

O problema e uma **condicao de corrida (race condition)** entre o frontend e o webhook, combinada com uma falha no encerramento de conversas.

### O que acontece passo a passo

```text
1. Dayara esta atendendo "Maria" (status: active, agent_id: dayara, assigned_at: 10:00)
2. Dayara clica "Encerrar atendimento"
3. Frontend atualiza: status="closed", closed_at="10:05"
   >>> MAS agent_id e assigned_at NAO sao limpos! <<<
   Resultado no banco: status=closed, agent_id=dayara, assigned_at=10:00
4. Maria envia nova mensagem (inbound)
5. Webhook processa a mensagem e le o assignment:
   - Se le ANTES do close: ve status=active, agent_id=dayara
     -> Define newStatus="active" (wasOfficiallyAssigned=true)
     -> Resultado: conversa volta para "Minhas" de Dayara como ATIVA!
   - Se le DEPOIS do close: ve status=closed
     -> Define newStatus="triage", limpa agent_id
     -> Resultado correto: vai para Fila
```

A corrida acontece quando uma mensagem chega quase simultaneamente ao encerramento. O webhook le o assignment ANTES do close ser gravado, calcula `newStatus = "active"` (porque `agent_id` e `assigned_at` existem), e sobrescreve o status. O `agent_id` nunca e limpo, entao a conversa reaparece em "Minhas".

### Evidencia no banco

A consulta mostra **20 conversas** com `status != "closed"`, `agent_id` preenchido, mas `closed_at` tambem preenchido -- prova de que foram encerradas e depois reabertas com o mesmo agente ainda atribuido.

### Locais afetados (3 funcoes de close que NAO limpam agent_id)

| Funcao | Linha | Descricao |
|--------|-------|-----------|
| `updateConversationStatus` | ~1338-1346 | Encerrar via menu de status |
| `dismissGroupConversation` | ~271-276 | Dispensar grupo |
| `deleteConversation` | ~1568-1571 | Apagar conversa (soft delete) |

### Solucao

**Passo 1 -- Frontend: Limpar `agent_id` ao encerrar**

Em todas as 3 funcoes de encerramento no `src/pages/RoyZapp.tsx`, adicionar `agent_id: null` e `assigned_at: null` ao `updateData` quando o status for "closed".

Isso garante que, mesmo em caso de race condition, o webhook NAO encontrara `agent_id` preenchido e a conversa NAO voltara para "Minhas".

Alteracao em `updateConversationStatus` (linha ~1338):
- Quando `newStatus === "closed"`, incluir `agent_id: null, assigned_at: null` no update

Alteracao em `dismissGroupConversation` (linha ~271):
- Incluir `agent_id: null, assigned_at: null` no update

Alteracao em `deleteConversation` (linha ~1568):
- Incluir `agent_id: null, assigned_at: null` no update

**Passo 2 -- Backend: Protecao adicional no webhook**

No `supabase/functions/uazapi-webhook/index.ts`, adicionar verificacao para que, quando o webhook processar uma mensagem e o assignment tiver `closed_at` recente (menos de 10 segundos), ele NAO altere o status. Isso previne a race condition mesmo que o close e o webhook ocorram quase simultaneamente.

Alteracao no webhook (linha ~1453):
- Apos encontrar o `existingAssignment`, verificar se `closed_at` e recente (< 10s). Se sim, pular a atualizacao do assignment para evitar sobrescrever o close.

**Passo 3 -- Correcao de dados existentes (migracao SQL)**

Executar uma migracao para limpar as conversas atualmente em estado inconsistente (status nao-closed mas com closed_at preenchido e sem atividade recente), forçando-as de volta para "closed" com agent_id nulo.

### Resumo das alteracoes

| Arquivo | Alteracao |
|---------|----------|
| `src/pages/RoyZapp.tsx` | Limpar `agent_id` e `assigned_at` nas 3 funcoes de close |
| `supabase/functions/uazapi-webhook/index.ts` | Protecao contra race condition: ignorar update se `closed_at` e recente |
| Migracao SQL | Corrigir dados inconsistentes existentes |
