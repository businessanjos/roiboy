

# Plano: Correção Urgente - Grupos Desaparecendo do ROY zAPP

## Diagnóstico do Problema

### Causa Real Identificada

**Os grupos NÃO desapareceram por causa da última atualização.** 

O problema é que os grupos estão sendo **fechados pelos agentes** como se fossem tickets de atendimento, e quando isso acontece, eles são filtrados da lista principal.

**Dados do Banco:**
- Total de grupos no setor Operações: 46
- Grupos com status "closed": 45 
- Grupos com status "waiting": 1 (Náyara Hungaro - o único visível na sua tela)

Os grupos foram sendo fechados ao longo dos últimos 8 dias pelos próprios agentes:
- 27/01: 3 grupos fechados
- 26/01: 15 grupos fechados  
- 21/01: 9 grupos fechados
- 19/01: 2 grupos fechados
- E assim por diante...

### Por que isso é um problema?

O sistema trata **grupos como tickets de atendimento**, aplicando a mesma lógica de filtragem. Quando um agente "fecha" um ticket de grupo, ele desaparece da lista principal (só aparece quando o filtro "Finalizados" está ativo).

**Porém, grupos são conversas permanentes!** Eles não deveriam sumir da lista como um ticket de suporte que foi resolvido.

---

## Solução Proposta

### Mudança 1: Grupos SEMPRE Visíveis (Ignorar status "closed" para grupos)

**Arquivo:** `src/components/royzapp/ZappConversationList.tsx`

Modificar a lógica de filtragem para que grupos sempre apareçam, independente do status:

```typescript
// Linha 76-89 - Modificar lógica de filtro closed
const filtered = assignments.filter((a) => {
  const contact = getContactInfo(a);
  const isGroup = contact.isGroup;
  
  // Hide archived conversations from main inbox
  const isArchived = a.zapp_conversation?.is_archived || false;
  if (isArchived) return false;
  
  // Filter by closed status - BUT GROUPS ALWAYS SHOW
  const isClosed = a.status === "closed";
  if (showClosed) {
    // When showing closed, ONLY show closed (groups or not)
    if (!isClosed) return false;
  } else {
    // When not showing closed, HIDE closed conversations
    // EXCEPTION: Groups are always visible (they're permanent conversations)
    if (isClosed && !isGroup) return false;
  }
  
  // ... resto do código
});
```

### Mudança 2: Reabrir Grupos Automaticamente Quando Recebem Mensagem

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts`

Quando um grupo recebe uma nova mensagem, garantir que o assignment seja reaberto para "active":

```typescript
// Ao processar mensagem inbound de grupo
if (isGroup && existingAssignment?.status === "closed") {
  await supabase
    .from("zapp_conversation_assignments")
    .update({ 
      status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("id", existingAssignment.id);
}
```

### Mudança 3: Corrigir Dados Existentes (Reabrir Grupos Fechados)

**Executar SQL para reabrir todos os grupos que foram fechados incorretamente:**

```sql
UPDATE zapp_conversation_assignments za
SET 
  status = 'active',
  closed_at = NULL,
  closed_by = NULL,
  updated_at = now()
FROM zapp_conversations zc
WHERE za.zapp_conversation_id = zc.id
  AND zc.is_group = true
  AND za.status = 'closed';
```

---

## Fluxo de Correção

```text
+------------------+     +--------------------+     +------------------+
|    Mudança 1     |     |     Mudança 2      |     |    Mudança 3     |
| Filtro Frontend  | --> | Webhook Reabrir    | --> | SQL Corrigir     |
| (grupos visíveis)|     | (grupos auto-open) |     | (dados antigos)  |
+------------------+     +--------------------+     +------------------+
```

---

## Arquivos a Modificar

| Arquivo | Mudança | Prioridade |
|---------|---------|------------|
| `src/components/royzapp/ZappConversationList.tsx` | Grupos sempre visíveis (ignorar closed) | URGENTE |
| `supabase/functions/uazapi-webhook/index.ts` | Reabrir grupo quando recebe mensagem | Alta |
| SQL Migration | Reabrir grupos fechados existentes | Alta |

---

## Resultado Esperado

Após as correções:
1. **Todos os 46 grupos** voltarão a aparecer na lista do setor Operações
2. Grupos não desaparecerão mais quando forem "fechados"
3. Grupos automaticamente voltarão para status "active" quando receberem mensagens
4. A funcionalidade de "fechar ticket" continuará funcionando normalmente para conversas individuais

---

## Seção Técnica

### Por que a última atualização não causou isso?

A última atualização modificou:
1. Filtro multi-instância para incluir conversas legadas
2. Eventos de webhook para sincronização de grupos
3. Handlers de eventos `chats` e `groups`

Nenhuma dessas mudanças alterou a lógica de exibição por status "closed". O problema é um comportamento pré-existente que estava acontecendo gradualmente à medida que agentes fechavam os tickets de grupo.

### Diferença entre Grupos e Tickets

| Aspecto | Ticket Individual | Grupo |
|---------|-------------------|-------|
| Natureza | Temporário (problema → solução) | Permanente (relação contínua) |
| Ciclo de vida | Abertura → Atendimento → Fechamento | Sempre ativo enquanto existir |
| Status "closed" | Correto (ticket resolvido) | Incorreto (grupo não "resolve") |

