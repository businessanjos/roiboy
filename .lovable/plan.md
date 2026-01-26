
# Análise: Separação de Propriedade por Setor no RoyZapp

## A Arquitetura ATUAL Já Suporta Propriedade Multi-Setor!

A análise do banco de dados confirma que o sistema **JÁ IMPLEMENTA** corretamente a separação de propriedade por setor:

### Exemplo Real do Banco de Dados

**Contato: Náyara Hungaro (+5511914339207)**

| Setor | Departamento | Agente Responsável | Status |
|-------|--------------|-------------------|--------|
| vendas | Vendas | Jonathan Marcato | active |
| operacoes | Operações | Michele Santos | closed |

**Mesma conversa, DUAS atribuições diferentes!**

Outros exemplos encontrados no banco:
- Tathiana Marinho Lopes → Vendas + Operações
- Hugo → Vendas + Operações
- Lucas Gouveia Zeoti → Vendas + Operações

---

## Como Funciona a Separação por Setor

```text
┌─────────────────────────────────────────────────────────────────┐
│                    zapp_conversations                           │
│                (ID: ed2e0c7f-cbea-4baa-829e-ea48e5cf4206)       │
│                phone_e164: +5511914339207                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌──────────────────────┐       ┌──────────────────────┐
│ zapp_conversation_   │       │ zapp_conversation_   │
│ assignments          │       │ assignments          │
│                      │       │                      │
│ department: Vendas   │       │ department: Operações│
│ agent: Jonathan M.   │       │ agent: Michele S.    │
│ status: active       │       │ status: closed       │
└──────────────────────┘       └──────────────────────┘
```

Cada setor tem sua **própria atribuição (assignment)** para a mesma conversa base. Isso permite:
- Vendas ter Vanessa como responsável
- Operações ter José como responsável
- Cada setor ver apenas suas conversas
- Histórico de mensagens compartilhado (mesmo cliente)

---

## O Problema Real: Filtro de Agentes

O problema que os vendedores estão enfrentando NÃO é de arquitetura, mas sim do **filtro de agentes** no `useZappData.tsx`:

```typescript
// Linhas 516-540: Filtro de agentes por departamento
filteredAgents = finalAgents.filter((a: Agent) => {
  // Show if assigned to this specific department
  if (a.department_id === targetDepartmentId) return true;
  
  // Show if assigned to ALL departments (null)
  if (a.department_id === null) return true;
  
  // Admins/gestores appear in all departments
  if (isAdmin || isGestor || hasAdminFlag) return true;
  
  return false;  // ❌ EXCLUI vendedores quando estão no setor errado
});
```

**Cenário do Bug:**
1. Vanessa (dept: Vendas) está visualizando setor Operações
2. Filtro exclui Vanessa da lista de agentes
3. `currentAgent = agents.find(a => a.user_id === currentUser.id)` = **undefined**
4. Filtro "Minhas": `a.agent_id === currentAgent?.id` = **sempre false**
5. Conversa não aparece na aba "Minhas"

---

## Solução Proposta

Modificar o filtro para **SEMPRE incluir o usuário atual** na lista de agentes, independente do departamento:

### Arquivo: `src/hooks/useZappData.tsx`

**Mudança nas linhas 516-540:**

```typescript
// Filter agents by current sector's department
// Include: current user, agents in this department, admins/gestores, or null department
let filteredAgents = finalAgents;
if (sectorId && targetDepartmentId) {
  filteredAgents = finalAgents.filter((a: Agent) => {
    // ✅ SEMPRE incluir o próprio usuário para que currentAgent funcione
    if (a.user_id === currentUser.id) {
      return true;
    }
    
    // Show if assigned to this specific department
    if (a.department_id === targetDepartmentId) {
      return true;
    }
    
    // Show if assigned to ALL departments (department_id is null)
    if (a.department_id === null) {
      return true;
    }
    
    // Admins/gestores appear in all departments
    // ... resto do código existente
  });
}
```

---

## Por que Esta Solução é Segura e Correta

| Aspecto | Garantia |
|---------|----------|
| **Isolamento de Setor** | Conversas continuam filtradas por `department_id` na query e no filteredAssignments |
| **Propriedade Separada** | Cada setor mantém sua própria atribuição com seu próprio agente responsável |
| **Aba "Minhas"** | O usuário só vê conversas onde ELE é o agente daquele setor específico |
| **Não expõe dados** | A mudança apenas garante que o usuário consiga se identificar como agente |

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useZappData.tsx` | Adicionar `if (a.user_id === currentUser.id) return true;` no início do filtro de agentes (linha 516) |

---

## Resultado Esperado

Após a correção:
1. Vendedor puxa conversa no setor de Vendas → aparece na aba "Minhas" do setor Vendas
2. Consultor puxa o mesmo cliente no setor Operações → aparece na aba "Minhas" do setor Operações
3. Cada setor mantém sua propriedade independente
4. A troca de setor mostra apenas as conversas daquele setor
