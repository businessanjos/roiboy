
# Plano: Correção de Mensagens Inbound que Não Chegam no ROY zAPP

## Diagnóstico Completo

Após investigação extensiva dos logs, banco de dados e código, identifiquei **múltiplas causas raiz** para o problema de mensagens não chegando:

### Problema 1: Conversas Duplicadas com Telefones em Formatos Diferentes

**Evidência no banco de dados:**

| Conversa | Telefone | Setor | Última Mensagem |
|----------|----------|-------|-----------------|
| Ana Paula (Vendas) | `+551991068935` (12 dígitos) | vendas | 12/Jan |
| Paulinha (Operações) | `+5519991068935` (13 dígitos) | operacoes | 26/Jan (hoje) |

**O que acontece:**
1. A conversa original foi criada com formato antigo (sem o 9)
2. Novas mensagens chegam com formato normalizado (com o 9)
3. O webhook cria uma NOVA conversa em vez de encontrar a existente
4. O usuário olha a conversa antiga (vazia) enquanto as mensagens vão para a nova

**Causa raiz no código:**
- O Layer 1 do fallback de busca (linha 792-820) tenta encontrar conversas com formato alternativo, MAS filtra por `integration_id`
- Como as conversas estão em integrações diferentes (vendas vs operações), o fallback não as encontra
- O Layer 2 (linha 822-914) deveria unificar, mas há uma falha na lógica de busca por formato alternativo

### Problema 2: Mensagens que Simplesmente Não Chegam

**Evidência:**
- Conversa `+5543998319449` tem 6 mensagens outbound hoje, mas 0 inbound desde 20/Jan
- O usuário enviou áudios às 16:26, mas a resposta do cliente não apareceu

**Possíveis causas:**
1. **UAZAPI não está enviando webhooks** para certas mensagens inbound
2. **Webhook está sendo ignorado** por algum filtro (reaction, status, etc.)
3. **Timeout ou erro silencioso** no processamento

### Problema 3: Falta de Vinculação Cliente-Conversa

A conversa "Paulinha" em Operações NÃO está vinculada ao cliente (`client_id: NULL`), mesmo existindo o cliente "Ana Paula Cardoso" com o mesmo telefone. Isso dificulta a rastreabilidade.

---

## Solução Proposta

### Correção 1: Melhorar Layer 1 - Busca Cross-Integration para BR Numbers

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (linhas 791-820)

O problema é que o Layer 1 filtra por `integration_id`, então não encontra conversas com o mesmo telefone em outras integrações/setores.

**Mudança:** Remover o filtro de `integration_id` no Layer 1 para números brasileiros, permitindo encontrar e ATUALIZAR conversas existentes:

```typescript
// === LAYER 1: Brazilian phone format fallback (cross-integration) ===
if (!existingZappConvo && phone && phone.startsWith("+55") && phone.length === 14) {
  const phoneWithout9 = phone.substring(0, 5) + phone.substring(6);
  console.log(`[PHONE] Fallback L1: trying ${phoneWithout9} (removed 9th digit) across ALL integrations`);
  
  // Search WITHOUT integration_id filter to find existing conversations
  const { data: fallbackData } = await supabase
    .from("zapp_conversations")
    .select("id, unread_count, integration_id, contact_name, client_id, lead_id, phone_e164, sector_id")
    .eq("account_id", accountId)
    .eq("phone_e164", phoneWithout9)
    .eq("is_group", false)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (fallbackData) {
    existingZappConvo = fallbackData;
    console.log(`[PHONE] Found via L1: old format ${phoneWithout9}, will update phone and integration`);
    
    // Update phone to normalized format AND update integration/sector
    await supabase
      .from("zapp_conversations")
      .update({ 
        phone_e164: phone,
        integration_id: integrationId,
        sector_id: sectorId
      })
      .eq("id", fallbackData.id);
  }
}
```

### Correção 2: Adicionar Logging Detalhado para Mensagens Ignoradas

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts`

Adicionar logs em TODOS os pontos de retorno para rastrear mensagens que não são processadas:

```typescript
// Adicionar no início de cada return ignorado:
console.log(`[IGNORED] reason: ${reason}, phone: ${phone || 'N/A'}, type: ${msg.type || 'N/A'}, msgId: ${msg.id || 'N/A'}`);
```

### Correção 3: Melhorar Validação de Mensagens Inbound

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts` (linhas 697-710)

Adicionar mais contexto nos logs de mensagens bloqueadas para facilitar debug:

```typescript
if (direction === "inbound" && !phone) {
  console.error(`[WEBHOOK] CRITICAL: Inbound message BLOCKED - missing phone`);
  console.error(`[WEBHOOK] Full payload snippet:`, JSON.stringify({
    chatPhone: chat.phone,
    chatId: chat.id,
    waChatid: chat.wa_chatid,
    sender: msg.sender,
    senderPn: msg.sender_pn,
    msgId: msg.id
  }));
  // Continue processing to avoid silent failures
}
```

### Correção 4: Trigger de Vinculação Automática Cliente-Conversa

Garantir que o trigger `sync_zapp_conversation_client` funcione corretamente quando o telefone muda:

**Verificação:** O trigger existe e está ativo, mas pode não estar sendo disparado quando o telefone é atualizado via Layer 1/Layer 2.

**Ação:** Adicionar chamada explícita para vincular cliente após atualizar telefone da conversa.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/uazapi-webhook/index.ts` | Melhorar Layer 1 (cross-integration), adicionar logging detalhado |

---

## Impacto Esperado

1. **Conversas com telefone antigo** serão encontradas e atualizadas automaticamente
2. **Logs detalhados** permitirão identificar exatamente quais mensagens estão sendo ignoradas e por quê
3. **Vinculação cliente-conversa** será mantida mesmo quando conversas migram entre setores

## Considerações de Segurança

Esta correção permite que uma conversa "migre" entre setores quando o mesmo cliente responde através de uma integração diferente. Isso é o comportamento desejado para evitar fragmentação de histórico, mas significa que:
- A conversa será movida para o setor da última integração que recebeu mensagem
- O histórico completo será preservado
- A vinculação com o cliente será mantida

## Resumo Técnico

O problema principal é a **fragmentação de conversas** causada por:
1. Formatos de telefone diferentes (12 vs 13 dígitos BR)
2. Múltiplas integrações/setores
3. Filtros muito restritivos na busca por conversa existente

A solução é tornar a busca mais flexível para números brasileiros, permitindo encontrar e unificar conversas mesmo que estejam em integrações diferentes.
