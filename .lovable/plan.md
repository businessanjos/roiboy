
# Plano: Corrigir Duplicação de Conversas - Unificação Automática

## Problema Diagnosticado

A correção anterior **só previne novas duplicações**, mas não resolve duplicações já existentes. 

### Situação Atual

No banco de dados existem **6 pares de conversas duplicadas** - cada par possui:
- Uma conversa **legada** (sem `integration_id`) com histórico antigo
- Uma conversa **nova** (com `integration_id`) criada recentemente

**Exemplo - Monick Oliveira Nunes:**
| Conversa | integration_id | Criada em | Mensagens |
|----------|---------------|-----------|-----------|
| `6354b7d9...` (nova) | `ac869d1d...` | 03/02 | 5 |
| `00b91bf9...` (legada) | NULL | 29/01 | 11 |

### Por Que a Correção Anterior Não Funcionou

O fallback implementado só é executado quando **não encontra nenhuma conversa** com o `integration_id` atual. Mas como a conversa nova já existe (foi criada antes da correção), a busca inicial a encontra e nunca chega no fallback.

```
Fluxo atual (COM BUG):
1. Buscar por phone + integration_id → ENCONTRA 6354b7d9 ✓
2. Fallback para legada → NÃO EXECUTADO (já encontrou acima)
3. Resultado: Duas conversas permanecem separadas ✗
```

---

## Solução: Unificação Automática de Duplicatas

A solução correta é **detectar e unificar duplicatas existentes** sempre que uma conversa é acessada ou uma mensagem é recebida.

### Fluxo Corrigido

```text
1. Buscar TODAS as conversas para o telefone no mesmo setor
   └── Encontrou múltiplas (legada + nova)?
       └── SIM: Unificar automaticamente
           ├── Mover todas as mensagens para a conversa mais antiga
           ├── Mover todos os assignments para a conversa mais antiga
           ├── Deletar a conversa duplicada
           └── Usar a conversa unificada
       └── NÃO: Continuar fluxo normal
```

### Modificações Técnicas

#### 1. `supabase/functions/uazapi-webhook/index.ts`

Adicionar lógica de unificação após encontrar a conversa:

```typescript
// APÓS a busca principal (linha ~848), adicionar:

// ============================================
// AUTO-UNIFY DUPLICATE CONVERSATIONS
// ============================================
// If we found a conversation with integration_id, check if there's also a legacy one
// If so, merge them to prevent showing duplicates in the UI

if (existingZappConvo && phone && sectorId && integrationId) {
  const { data: legacyDuplicate } = await supabase
    .from("zapp_conversations")
    .select("id")
    .eq("account_id", accountId)
    .eq("phone_e164", phone)
    .eq("sector_id", sectorId)
    .is("integration_id", null)
    .eq("is_group", false)
    .neq("id", existingZappConvo.id)
    .maybeSingle();
  
  if (legacyDuplicate) {
    console.log(`[AUTO-UNIFY] Merging legacy ${legacyDuplicate.id} into ${existingZappConvo.id}`);
    
    // 1. Move all messages from legacy to current
    await supabase
      .from("zapp_messages")
      .update({ zapp_conversation_id: existingZappConvo.id })
      .eq("zapp_conversation_id", legacyDuplicate.id);
    
    // 2. Move/delete assignments from legacy
    await supabase
      .from("zapp_conversation_assignments")
      .delete()
      .eq("zapp_conversation_id", legacyDuplicate.id);
    
    // 3. Delete legacy conversation
    await supabase
      .from("zapp_conversations")
      .delete()
      .eq("id", legacyDuplicate.id);
    
    console.log(`[AUTO-UNIFY] Completed: legacy conversation deleted`);
  }
}
```

#### 2. `src/pages/RoyZapp.tsx`

Aplicar a mesma lógica na função `createConversationWithContact`:

Após encontrar uma conversa com `integration_id`, verificar se existe uma duplicata legada e unificá-las.

---

## Tabelas Afetadas

| Tabela | Operação |
|--------|----------|
| `zapp_messages` | UPDATE para mover mensagens para conversa principal |
| `zapp_conversation_assignments` | DELETE dos assignments da conversa legada |
| `zapp_conversations` | DELETE da conversa legada duplicada |

---

## Benefícios

1. **Corrige duplicatas existentes** - as 6 duplicatas serão unificadas automaticamente
2. **Preserva histórico completo** - todas as mensagens ficam na mesma conversa
3. **Auto-healing** - funciona sob demanda quando a conversa é acessada ou recebe mensagem
4. **Sem intervenção manual** - o usuário não precisa fazer nada

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar lógica de auto-unify após encontrar conversa |
| `src/pages/RoyZapp.tsx` | Adicionar mesma lógica em `createConversationWithContact` |

---

## Estimativa

- **Complexidade**: Média
- **Risco**: Baixo (operação segura - apenas move dados e deleta duplicatas)
- **Impacto**: Alto (resolve problema de duplicação para todos os usuários afetados)
