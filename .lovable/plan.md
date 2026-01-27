

# Plano: Adicionar Tipo de Atividade "Alinhamento ou Reunião"

## Diagnóstico

### Situação Atual

Na tela de "Nova Tarefa" dentro do perfil do cliente (aba Agenda), o dropdown "Tipo de Atividade" mostra apenas as opções para o setor de Operações:

| Tipo Atual | Ícone | Cor |
|------------|-------|-----|
| Onboarding | users | #0ea5e9 |
| Implementação da Clínica Ryka | calendar | #8b5cf6 |
| Implementação das Ferramentas de IA | calendar | #14b8a6 |
| Suporte de Ferramentas | wrench | #f59e0b |
| Back office | briefcase | #6366f1 |
| Apresentação do Plano de Ação | presentation | #10b981 |

### O Que Falta

O usuário precisa da opção **"Alinhamento ou Reunião"** para registrar tarefas de reuniões de alinhamento com clientes.

## Solução Proposta

### Migração SQL

Adicionar um novo tipo de atividade na tabela `activity_types` para cada conta (`account_id`) que já possui tipos de operações configurados.

### Configuração do Novo Tipo

| Campo | Valor |
|-------|-------|
| **name** | Alinhamento ou Reunião |
| **icon** | users |
| **color** | #f59e0b (amber-500) |
| **sector_id** | operacoes |
| **display_order** | 17 (após "Apresentação do Plano de Ação") |
| **is_active** | true |

### SQL da Migração

```sql
-- Adicionar tipo "Alinhamento ou Reunião" para todas as contas que têm tipos de operações
INSERT INTO activity_types (account_id, name, icon, color, sector_id, display_order, is_active, description)
SELECT DISTINCT 
  account_id,
  'Alinhamento ou Reunião',
  'users',
  '#f59e0b',
  'operacoes',
  17,
  true,
  'Reuniões de alinhamento com clientes'
FROM activity_types 
WHERE sector_id = 'operacoes' 
  AND is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM activity_types at2 
    WHERE at2.account_id = activity_types.account_id 
      AND at2.name = 'Alinhamento ou Reunião'
      AND at2.sector_id = 'operacoes'
  );
```

## Resultado Esperado

### Dropdown Atualizado

```text
┌─────────────────────────────────────┐
│  Tipo de Atividade *                │
│  [Selecione o tipo de atividade ▼]  │
├─────────────────────────────────────┤
│  ● Onboarding                       │
│  ● Implementação da Clínica Ryka    │
│  ● Implementação das Ferramentas... │
│  ● Suporte de Ferramentas           │
│  ● Back office                      │
│  ● Apresentação do Plano de Ação    │
│  ● Alinhamento ou Reunião      ← NOVO
└─────────────────────────────────────┘
```

## Contas Afetadas

A migração adicionará o novo tipo para as seguintes contas:

- 796e7970-fd93-4574-a871-6090624cace6
- 68f63a04-db94-46aa-a433-2a236fe8111a
- 21a69ee1-a7fc-49e6-b61d-871ff50235b8
- 2abb5823-50f4-4415-851d-a931f608dd36
- b29f4820-c998-4e58-af5b-273691c45628
- 67dceab4-620e-488e-8a73-3f889357a01f
- c0b2fe21-56aa-4754-a50b-1833ed1b9b09

## Benefícios

| Aspecto | Descrição |
|---------|-----------|
| **Categorização** | Tarefas de reunião terão tipo específico |
| **Organização** | Facilita filtrar e buscar reuniões de alinhamento |
| **Consistência** | Segue o padrão dos outros tipos de atividade |
| **Retrocompatibilidade** | Não afeta tarefas existentes |

## Nenhuma Alteração de Código Necessária

Como o sistema já carrega tipos de atividade dinamicamente via `useActivityTypes`, nenhuma modificação de código é necessária. A nova opção aparecerá automaticamente após a migração.

