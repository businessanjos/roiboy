

## Plano: Aplicar filtro de preferências no envio de push do uazapi-webhook

### Problema

O filtro de setor nas preferências de notificação push **não funciona para mensagens do zAPP** porque:

1. O `uazapi-webhook` chama `send-push` diretamente com `account_id` (envia para **todos** os usuários da conta), sem passar por nenhuma verificação de preferências.
2. A Edge Function `send-push` não consulta a tabela `push_notification_preferences` — simplesmente envia para todas as subscriptions encontradas.
3. O trigger `send_push_on_notification` (que **respeita** as preferências) só é acionado por INSERTs na tabela `notifications`, mas o webhook do zAPP **não insere** na tabela `notifications` — ele chama `send-push` diretamente via HTTP.

Em resumo: o caminho de push do zAPP ignora completamente as preferências do usuário.

### Solução

Modificar a Edge Function `send-push` para consultar `push_notification_preferences` antes de enviar, filtrando por categoria e setor. Isso resolve o problema para **todos** os caminhos que chamam `send-push`, incluindo o webhook.

### Alterações

**Arquivo: `supabase/functions/send-push/index.ts`**

1. Aceitar novo campo opcional no body: `category` (ex: `'zapp_messages'`) e `sector_id`
2. Quando enviando por `account_id`, para **cada user_id** nas subscriptions:
   - Consultar `push_notification_preferences` do usuário
   - Verificar se a categoria está habilitada (ex: `notify_zapp_messages`)
   - Verificar se o `sector_id` está na lista `notify_sectors` (ou se a lista é vazia/null = todos)
   - Pular o envio se qualquer verificação falhar
3. Quando enviando por `user_id` (já filtrado pelo trigger), manter comportamento atual

**Arquivo: `supabase/functions/uazapi-webhook/index.ts`**

1. Adicionar `category: 'zapp_messages'` e `sector_id: sectorId` ao body do `send-push` call (linha ~1465)

### Resultado Esperado

Usuário que marcou apenas "Vendas" nos setores receberá push **somente** de mensagens do zAPP associadas ao setor Vendas. Mensagens de outros setores serão filtradas.

