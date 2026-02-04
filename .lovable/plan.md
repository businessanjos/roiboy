
# Automação de Checkpoint Recorrente (15 dias)

## Objetivo
Criar um sistema que automaticamente gera uma nova tarefa "Checkpoint" 15 dias após a conclusão da anterior, mantendo as mesmas propriedades (responsável, prioridade, vínculo, tipo e descrição).

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│           Usuário conclui tarefa "Checkpoint"                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Database Trigger: on_checkpoint_completed          │
│                                                              │
│  1. Verifica se activity_type_id = ID do tipo "Checkpoint"  │
│  2. Verifica se OLD.completed_at IS NULL e NEW.completed_at │
│     IS NOT NULL (transição para concluído)                   │
│  3. Cria nova tarefa com:                                    │
│     - Mesmo client_id, assigned_to, priority, description   │
│     - due_date = completed_at + 15 dias                      │
│     - status = 'pending', completed_at = NULL                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Nova tarefa "Checkpoint" criada                    │
│           (aparece automaticamente na Agenda do Cliente)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementação

### Parte 1: Criar o Tipo de Atividade "Checkpoint"

Inserir um novo registro na tabela `activity_types`:

| Campo | Valor |
|-------|-------|
| name | Checkpoint |
| icon | flag-triangle-right |
| color | #f97316 (laranja) |
| sector_id | operacoes |
| display_order | 10 |
| is_active | true |

### Parte 2: Criar Database Trigger

O trigger será executado após UPDATE na tabela `internal_tasks` e verificará:

1. Se o `activity_type_id` corresponde a um tipo "Checkpoint"
2. Se a tarefa foi recém-concluída (`OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL`)
3. Se a tarefa tem um `client_id` válido (pois Checkpoints são específicos de clientes)

#### Lógica do Trigger

```sql
-- Função que cria a próxima tarefa Checkpoint
CREATE OR REPLACE FUNCTION create_next_checkpoint_task()
RETURNS TRIGGER AS $$
DECLARE
  checkpoint_type_id uuid;
BEGIN
  -- Busca o ID do tipo "Checkpoint" para a mesma account
  SELECT id INTO checkpoint_type_id
  FROM activity_types
  WHERE name = 'Checkpoint' 
    AND account_id = NEW.account_id
    AND is_active = true
  LIMIT 1;

  -- Só processa se:
  -- 1. A tarefa é do tipo Checkpoint
  -- 2. Foi recém-concluída (transição NULL -> não NULL)
  -- 3. Tem client_id (é tarefa de cliente)
  IF NEW.activity_type_id = checkpoint_type_id 
     AND OLD.completed_at IS NULL 
     AND NEW.completed_at IS NOT NULL
     AND NEW.client_id IS NOT NULL
  THEN
    INSERT INTO internal_tasks (
      account_id,
      title,
      description,
      status,
      priority,
      due_date,
      client_id,
      assigned_to,
      created_by,
      activity_type_id
    ) VALUES (
      NEW.account_id,
      'Checkpoint',
      NEW.description,
      'pending',
      NEW.priority,
      (NEW.completed_at::date + INTERVAL '15 days')::date,
      NEW.client_id,
      NEW.assigned_to,
      NEW.created_by,
      NEW.activity_type_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que chama a função
CREATE TRIGGER trigger_checkpoint_recurrence
  AFTER UPDATE ON internal_tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_next_checkpoint_task();
```

---

## Fluxo de Uso

1. Usuário acessa a aba "Agenda" no perfil do cliente
2. Clica em "+ Nova Tarefa"
3. Seleciona o tipo "Checkpoint" (novo na lista)
4. Preenche os dados: responsável, prioridade, data, descrição
5. Cria a tarefa
6. Quando marca a tarefa como "Feita":
   - Sistema automaticamente cria uma nova tarefa Checkpoint
   - Nova data = data de conclusão + 15 dias
   - Mesmos: responsável, prioridade, descrição, tipo, cliente

---

## Campos Copiados para Nova Tarefa

| Campo | Origem |
|-------|--------|
| account_id | Mantido da tarefa original |
| title | "Checkpoint" (fixo) |
| description | Copiado da tarefa concluída |
| status | "pending" (padrão) |
| priority | Copiado da tarefa concluída |
| due_date | completed_at + 15 dias |
| client_id | Copiado da tarefa concluída |
| assigned_to | Copiado da tarefa concluída |
| created_by | Copiado da tarefa concluída |
| activity_type_id | ID do tipo "Checkpoint" |

---

## Regras de Negócio

1. **Apenas client_id**: O Checkpoint só dispara automação se estiver vinculado a um cliente (não para deals/leads avulsos)
2. **Apenas na transição**: Só cria nova tarefa quando `completed_at` muda de NULL para um valor (evita duplicatas)
3. **15 dias fixos**: O intervalo é sempre 15 dias a partir da data de conclusão
4. **Sem limite de recorrência**: Cada conclusão gera uma nova tarefa infinitamente

---

## Arquivos/Recursos a Modificar

| Recurso | Ação |
|---------|------|
| Tabela `activity_types` | Inserir tipo "Checkpoint" para cada account |
| Função `create_next_checkpoint_task()` | Criar no banco |
| Trigger `trigger_checkpoint_recurrence` | Criar no banco |

---

## Considerações

- O trigger processa automaticamente no banco, garantindo que a automação funcione independente de qual interface criou/concluiu a tarefa
- A UI não precisa de modificações - o tipo "Checkpoint" aparecerá automaticamente na lista de tipos de atividade
- O realtime já está configurado em `ClientTasks.tsx`, então a nova tarefa aparecerá instantaneamente
