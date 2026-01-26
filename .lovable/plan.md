

# Plano Crítico: Correção de Mensagens não Chegando no ROY zAPP

## Diagnóstico Completo

### Problema Identificado
Mensagens do cliente **Aleff Oliveira** (+55 31 98956-0046) enviadas às 09:02 não aparecem na interface do atendente **José da Paixão**.

### Causa Raiz
Existem **DUAS conversas duplicadas** para o mesmo cliente no banco de dados:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CONVERSAS DUPLICADAS - ALEFF OLIVEIRA                                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Conversa 1 (2b7903f9)                    │ Conversa 2 (d33bcdbd)                       │
│ ─────────────────────────────────────────┼────────────────────────────────────────────│
│ Telefone: +5531989560046 (normalizado)   │ Telefone: +55 31 98956-0046 (com espaços)  │
│ Atendente: Vanessa Minelli               │ Atendente: José da Paixão                  │
│ Departamento: Vendas                     │ Departamento: Operações                    │
│ Mensagens: 100                           │ Mensagens: 12                              │
│ Última mensagem: 26/01 13:36 ✓           │ Última mensagem: 23/01 14:37               │
│ ← MENSAGENS NOVAS VÃO PARA AQUI          │ ← JOSE ESTA OLHANDO ESTA                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Fluxo do Problema

```text
1. CLIENTE ENVIA MENSAGEM
   └─> Webhook UAZAPI recebe com telefone "+55 31 98956-0046"
        │
2. WEBHOOK NORMALIZA TELEFONE
   └─> Converte para "+5531989560046"
        │
3. WEBHOOK BUSCA CONVERSA (Layer 2)
   └─> Busca qualquer conversa com esse telefone
   └─> Encontra 2b7903f9 (mais recente) ← PROBLEMA AQUI
        │
4. MENSAGEM SALVA NA CONVERSA ERRADA
   └─> Salva em 2b7903f9 (Vanessa/Vendas)
   └─> José está olhando d33bcdbd (Operações)
        │
5. JOSE NÃO VÊ A MENSAGEM
   └─> Ele está subscrito ao realtime de d33bcdbd
   └─> A mensagem foi para 2b7903f9
```

## Solução Proposta

### Parte 1: Correção Imediata (Unificação de Conversas Duplicadas)

Executar migração SQL para mover mensagens da conversa duplicada para a principal e deletar a duplicata.

```sql
-- 1. Identificar a conversa principal (mais recente/mais mensagens)
-- 2. Mover todas as mensagens para a conversa principal
-- 3. Atualizar assignments para apontar para conversa principal
-- 4. Deletar a conversa duplicata
```

### Parte 2: Prevenção no Webhook (Melhoria do Layer 2)

Modificar o webhook `uazapi-webhook/index.ts` para:

1. **Detectar múltiplas conversas** para o mesmo telefone
2. **Priorizar por setor/integration_id** em vez de apenas data
3. **Unificar automaticamente** se encontrar duplicatas do mesmo account+sector
4. **Atualizar assignments associados** quando unificar

### Alteracoes Tecnicas

#### Arquivo 1: Migração SQL (Correção Imediata)

```sql
-- Unificar conversas de Aleff Oliveira
DO $$
DECLARE
  v_principal_id uuid := '2b7903f9-c997-440a-824c-ad1049674961';
  v_duplicate_id uuid := 'd33bcdbd-fadd-45af-b8c6-e98f7e37f47e';
BEGIN
  -- Mover mensagens da duplicata para a principal
  UPDATE zapp_messages 
  SET zapp_conversation_id = v_principal_id
  WHERE zapp_conversation_id = v_duplicate_id;
  
  -- Atualizar assignment da duplicata para apontar para a principal
  UPDATE zapp_conversation_assignments
  SET zapp_conversation_id = v_principal_id
  WHERE zapp_conversation_id = v_duplicate_id;
  
  -- Deletar a conversa duplicata
  DELETE FROM zapp_conversations WHERE id = v_duplicate_id;
  
  RAISE NOTICE 'Unificação concluída: % → %', v_duplicate_id, v_principal_id;
END $$;

-- Unificar conversas de Hugo (outra duplicata encontrada)
DO $$
DECLARE
  v_principal_id uuid := '9787190d-51f2-4e54-85bb-dee841cd4c66'; -- vendas, mais recente
  v_duplicate_id uuid := 'be62d6b7-7a82-416a-aa22-b5bb07fadf3f'; -- operacoes
BEGIN
  UPDATE zapp_messages 
  SET zapp_conversation_id = v_principal_id
  WHERE zapp_conversation_id = v_duplicate_id;
  
  UPDATE zapp_conversation_assignments
  SET zapp_conversation_id = v_principal_id
  WHERE zapp_conversation_id = v_duplicate_id;
  
  DELETE FROM zapp_conversations WHERE id = v_duplicate_id;
  
  RAISE NOTICE 'Unificação concluída: % → %', v_duplicate_id, v_principal_id;
END $$;
```

#### Arquivo 2: `supabase/functions/uazapi-webhook/index.ts`

Modificar a busca Layer 2 (linhas ~822-873) para:

1. **Buscar TODAS as conversas** com o mesmo telefone (não apenas 1)
2. **Priorizar por sector_id/integration_id** que corresponde ao webhook atual
3. **Se encontrar múltiplas do mesmo sector**, unificar automaticamente

**Mudancas na logica Layer 2:**

```typescript
// ANTES: .limit(1).maybeSingle()
// DEPOIS: busca todas e escolhe a melhor match

// Buscar TODAS conversas com esse telefone
const { data: allConvos } = await supabase
  .from("zapp_conversations")
  .select("id, unread_count, integration_id, contact_name, client_id, lead_id, phone_e164, sector_id")
  .eq("account_id", accountId)
  .eq("is_group", false)
  .or(phoneConditions)
  .order("last_message_at", { ascending: false });

if (allConvos && allConvos.length > 0) {
  // Prioridade: mesmo integration_id > mesmo sector_id > mais recente
  let bestMatch = allConvos.find(c => c.integration_id === integrationId);
  if (!bestMatch && sectorId) {
    bestMatch = allConvos.find(c => c.sector_id === sectorId);
  }
  if (!bestMatch) {
    bestMatch = allConvos[0]; // mais recente
  }
  
  existingZappConvo = bestMatch;
  
  // UNIFICAÇÃO AUTOMÁTICA: Se houver duplicatas do mesmo account+sector
  if (allConvos.length > 1) {
    const duplicates = allConvos.filter(c => c.id !== bestMatch.id);
    for (const dup of duplicates) {
      // Mover mensagens
      await supabase.from("zapp_messages")
        .update({ zapp_conversation_id: bestMatch.id })
        .eq("zapp_conversation_id", dup.id);
      
      // Atualizar assignments
      await supabase.from("zapp_conversation_assignments")
        .update({ zapp_conversation_id: bestMatch.id })
        .eq("zapp_conversation_id", dup.id);
      
      // Deletar duplicata
      await supabase.from("zapp_conversations")
        .delete()
        .eq("id", dup.id);
        
      console.log(`[DEDUPE] Unified conversation ${dup.id} → ${bestMatch.id}`);
    }
  }
}
```

### Parte 3: Adicionar Constraint de Unicidade

Para prevenir futuras duplicatas, adicionar constraint no banco:

```sql
-- Criar índice único para evitar duplicatas futuras
-- (account_id + telefone normalizado + is_group=false)
CREATE UNIQUE INDEX IF NOT EXISTS zapp_conversations_unique_phone_idx 
ON zapp_conversations (account_id, REGEXP_REPLACE(phone_e164, '[^0-9]', '', 'g'))
WHERE is_group = false AND phone_e164 IS NOT NULL AND phone_e164 != '';
```

**Nota:** Este índice pode precisar ser adiado até depois da limpeza de duplicatas.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Unificar conversas duplicadas existentes |
| `supabase/functions/uazapi-webhook/index.ts` | Melhorar Layer 2 para detectar e unificar duplicatas |
| Migração SQL (opcional) | Criar constraint de unicidade |

## Ordem de Execução

1. **Primeiro**: Executar migração SQL para unificar as 2 duplicatas encontradas
2. **Segundo**: Atualizar o webhook para prevenir novas duplicatas
3. **Terceiro** (opcional): Criar constraint de unicidade após confirmar que não há mais duplicatas

## Impacto

- **José da Paixão** verá todas as mensagens de Aleff Oliveira após a unificação
- **Mensagens futuras** irão corretamente para a conversa unificada
- **Prevenção** de novas duplicatas pelo webhook melhorado

## Testes de Validação

1. Verificar que a conversa d33bcdbd não existe mais
2. Verificar que todas as mensagens estão em 2b7903f9
3. Verificar que José da Paixão consegue ver as mensagens
4. Testar envio de nova mensagem pelo cliente e confirmar que aparece no chat correto

