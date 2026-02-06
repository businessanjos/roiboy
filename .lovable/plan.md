
# Diagnóstico e Plano de Correção: Conversas Aparecendo Incorretamente na Aba "Minhas"

## Diagnóstico do Problema

### Evidências Encontradas

1. **Perfil da Dayara Grecco:**
   - `team_role_name: Consultor` (NÃO é Admin nem Gestor)
   - `is_also_admin: false`
   - Portanto, ela NÃO tem a "visibilidade total" de gestores

2. **Conversas Atribuídas à Dayara:**
   Encontrei 11 conversas com status ≠ `closed` atribuídas a ela, porém VÁRIAS já tinham sido fechadas (`closed_at` preenchido):

   | Contato | Status Atual | closed_at |
   |---------|--------------|-----------|
   | Anini & Diego | active | 2026-02-04 16:37 |
   | Lucas Zeoti & Luma | waiting | 2026-02-04 20:09 |
   | JOSIANE F. FERREIRA | active | 2026-02-05 14:44 |
   | Maria Tainá | active | 2026-01-28 18:59 |
   | Mila Azevedo | active | 2026-02-04 16:36 |

   **Conclusão:** Essas conversas foram FINALIZADAS pela Dayara, mas reabertas automaticamente quando o cliente enviou nova mensagem.

### Causa Raiz Identificada

No arquivo `supabase/functions/uazapi-webhook/index.ts`, quando um cliente envia mensagem para uma conversa já **fechada (`closed`)**, o sistema:

```typescript
// Linha 1490-1492
if (existingAssignment.status === "closed") {
  newStatus = direction === "inbound" ? "triage" : "closed";
}
// ...
.update({
  updated_at: timestamp,
  status: newStatus,
  // ❌ O agent_id NÃO é limpo!
})
```

O status muda para `triage` (depois para `active` ou `pending` dependendo do fluxo), MAS o `agent_id` **permanece vinculado à Dayara**. Resultado: a conversa reaparece na aba "Minhas" dela.

---

## Solução Proposta

### Correção 1: Limpar Atendente ao Reabrir Conversa Fechada (Webhook)

**Arquivo:** `supabase/functions/uazapi-webhook/index.ts`

**Lógica:** Quando uma conversa com status `closed` recebe uma mensagem inbound, devemos:
1. Mudar status para `triage`
2. **Limpar o `agent_id`** e `assigned_at`
3. Assim a conversa volta para a **Fila Geral** em vez de aparecer na aba do último atendente

**Mudanças necessárias em 2 locais:**

**Local 1 (linhas 1509-1518):**
```typescript
.update({
  updated_at: timestamp,
  status: newStatus,
  // CORREÇÃO: Se reabrindo de closed, limpar atendente para voltar à fila
  ...(existingAssignment.status === "closed" && newStatus === "triage" 
    ? { agent_id: null, assigned_at: null } 
    : {}),
  ...(sectorDepartmentId && !existingAssignment.department_id 
    ? { department_id: sectorDepartmentId } 
    : {}),
})
```

**Local 2 (linhas 1880-1890):**
```typescript
.update({
  updated_at: timestamp,
  status: existingAssignment.status === "closed" ? "triage" : existingAssignment.status,
  // CORREÇÃO: Se reabrindo de closed, limpar atendente para voltar à fila
  ...(existingAssignment.status === "closed" 
    ? { agent_id: null, assigned_at: null } 
    : {}),
  ...(sectorDepartmentId && !existingAssignment.department_id 
    ? { department_id: sectorDepartmentId } 
    : {}),
})
```

### Correção 2: Script de Limpeza para Conversas Já Afetadas

As conversas que já reapareceram incorretamente precisam ser corrigidas manualmente ou via script:

```sql
-- Identificar conversas reabertas que ainda têm agent_id
UPDATE zapp_conversation_assignments
SET agent_id = NULL, assigned_at = NULL
WHERE status = 'triage' 
  AND agent_id IS NOT NULL 
  AND closed_at IS NOT NULL;
```

Isso enviará as conversas reabertas de volta para a Fila.

---

## Benefícios da Correção

1. **Fim das conversas "fantasma":** Quando Dayara encerrar um atendimento, ele não voltará para ela automaticamente no dia seguinte
2. **Distribuição justa:** Conversas reabertas voltam para a Fila Geral, permitindo que qualquer atendente disponível assuma
3. **Aba "Minhas" limpa:** A aba "Minhas" mostrará apenas o que realmente está sob responsabilidade do usuário

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/uazapi-webhook/index.ts` | Adicionar lógica para limpar `agent_id` ao reabrir conversas fechadas (2 locais) |

---

## Observação Adicional

Verifiquei que a Dayara **não é Gestora nem Admin**, então o problema de "visibilidade ampla" (onde gestores veem todas as conversas) NÃO se aplica a ela. O problema é puramente o **agent_id não sendo limpo na reabertura**.

Se no futuro quiserem que gestores também tenham a aba "Minhas" estritamente pessoal (mostrando apenas o que é deles), posso ajustar o frontend também. Mas para resolver o problema URGENTE da Dayara, a correção do webhook é suficiente.
