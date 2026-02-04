
# Automação de Onboarding de Novos Clientes

## Objetivo
Criar automaticamente um evento de Onboarding e duas tarefas padrão ("Implementação da Clínica Ryka" e "Apresentação do Plano de Ação") sempre que um lead for convertido em cliente no fluxo de vendas.

## O que será criado automaticamente

### 1. Evento "Onboarding"
| Campo | Valor |
|-------|-------|
| Título | Onboarding |
| Descrição | Onboarding Inicial |
| Tipo de Evento | Live / Encontro |
| Modalidade | Online |
| Data/Hora | Vazio (preenchimento manual) |
| Status de participação | Não participou |

### 2. Tarefa "Implementação da Clínica Ryka"
| Campo | Valor |
|-------|-------|
| Tipo de Atividade | Implementação da Clínica Ryka |
| Descrição | Vazio |
| Responsável | Vazio (preenchimento manual) |
| Data | Vazio (preenchimento manual) |
| Prioridade | Média |
| Status | Pendente |

### 3. Tarefa "Apresentação do Plano de Ação"
| Campo | Valor |
|-------|-------|
| Tipo de Atividade | Apresentação do Plano de Ação |
| Descrição | Reunião para apresenta o Plano de Ação e tirar dúvidas. |
| Responsável | Vazio (preenchimento manual) |
| Data | Vazio (preenchimento manual) |
| Prioridade | Média |
| Status | Pendente |

---

## Detalhes Técnicos

### Arquivos a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/pages/SalesPipeline.tsx` | Adicionar função de automação após conversão |
| `src/utils/clientOnboardingAutomation.ts` | Criar arquivo para lógica de automação |

### Fluxo de Implementação

```text
┌─────────────────────────┐
│   Lead ganha negócio    │
│   (handleMarkAsWon)     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ convert_lead_to_client  │
│    (clientId criado)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  NOVO: Automação de     │
│  Onboarding             │
└───────────┬─────────────┘
            │
   ┌────────┴────────┐
   │                 │
   ▼                 ▼
┌──────────┐  ┌─────────────────┐
│ Evento   │  │ 2 Tarefas com   │
│Onboarding│  │ o Cliente       │
└──────────┘  └─────────────────┘
```

### 1. Novo Arquivo: `src/utils/clientOnboardingAutomation.ts`

Função que encapsula toda a lógica de criação automática:

```typescript
interface OnboardingAutomationParams {
  clientId: string;
  accountId: string;
  userId: string;
}

export async function createClientOnboardingItems({
  clientId,
  accountId,
  userId
}: OnboardingAutomationParams): Promise<void> {
  // 1. Criar evento "Onboarding"
  // - Tipo: 'live'
  // - Modalidade: 'online'
  // - Título: "Onboarding"
  // - Descrição: "Onboarding Inicial"
  // - scheduled_at: null (data vazia)
  // - category: 'operation'
  
  // 2. Vincular cliente ao evento (event_participants)
  // - rsvp_status: 'pending' (aparece como "Não participou")
  
  // 3. Buscar activity_types para as tarefas
  // - "Implementação da Clínica Ryka"
  // - "Apresentação do Plano de Ação"
  
  // 4. Criar tarefa "Implementação da Clínica Ryka"
  // - client_id: clientId
  // - assigned_to: null (vazio)
  // - due_date: null (vazio)
  // - priority: 'medium'
  // - status: 'pending'
  
  // 5. Criar tarefa "Apresentação do Plano de Ação"
  // - client_id: clientId
  // - description: "Reunião para apresenta o Plano de Ação e tirar dúvidas."
  // - assigned_to: null (vazio)
  // - due_date: null (vazio)
  // - priority: 'medium'
  // - status: 'pending'
}
```

### 2. Modificação: `src/pages/SalesPipeline.tsx`

Chamar a função de automação após a conversão do cliente (aproximadamente após linha 426):

```typescript
// STEP 4.1: Create automatic onboarding items for new client
if (clientId && currentUser?.account_id) {
  try {
    await createClientOnboardingItems({
      clientId,
      accountId: currentUser.account_id,
      userId: currentUser.id,
    });
    console.log("[MarkAsWon] Onboarding items created for new client");
  } catch (onboardingError) {
    console.error("[MarkAsWon] Error creating onboarding items:", onboardingError);
    // Non-blocking - continue the flow
  }
}
```

### Estrutura de Dados no Banco

**Evento criado em `events`:**
```json
{
  "account_id": "{{account_id}}",
  "title": "Onboarding",
  "description": "Onboarding Inicial",
  "event_type": "live",
  "modality": "online",
  "scheduled_at": null,
  "category": "operation"
}
```

**Participação em `event_participants`:**
```json
{
  "account_id": "{{account_id}}",
  "event_id": "{{event_id}}",
  "client_id": "{{client_id}}",
  "rsvp_status": "pending",
  "invited_by": "{{user_id}}"
}
```

**Tarefas em `internal_tasks`:**
```json
[
  {
    "account_id": "{{account_id}}",
    "client_id": "{{client_id}}",
    "title": "Implementação da Clínica Ryka",
    "activity_type_id": "{{activity_type_id}}",
    "status": "pending",
    "priority": "medium",
    "created_by": "{{user_id}}"
  },
  {
    "account_id": "{{account_id}}",
    "client_id": "{{client_id}}",
    "title": "Apresentação do Plano de Ação",
    "description": "Reunião para apresenta o Plano de Ação e tirar dúvidas.",
    "activity_type_id": "{{activity_type_id}}",
    "status": "pending",
    "priority": "medium",
    "created_by": "{{user_id}}"
  }
]
```

---

## Comportamento Esperado

1. Vendedor marca negócio como "Ganho"
2. Sistema converte lead em cliente
3. Sistema cria automaticamente:
   - 1 evento de Onboarding (aparece na aba Agenda do cliente)
   - 2 tarefas pendentes (aparecem na seção "Tarefas com o Cliente")
4. Operações recebe o cliente já com os itens prontos para agendamento

## Observações

- A automação não bloqueia o fluxo principal se houver erro
- Os activity_types são buscados dinamicamente por nome e account_id
- Se um activity_type não existir para a conta, a tarefa usa apenas o título
