

# Plano: Criar Itens de Onboarding para Ariella Duarte

## Dados Identificados

| Campo | Valor |
|-------|-------|
| **Cliente** | Ariella Duarte |
| **Client ID** | `45ebabf0-ed84-44d2-be23-18f8a9b8f979` |
| **Account ID** | `796e7970-fd93-4574-a871-6090624cace6` |
| **Activity Type (Onboarding)** | `a2fd7380-58ab-42ac-8de1-66805e3004d0` |

---

## Itens a Criar

### 1. Evento "Onboarding"
- **Tipo**: Live
- **Modalidade**: Online  
- **Categoria**: operation
- **Cliente vinculado**: Ariella Duarte

### 2. Tarefas
1. **Implementação da Clínica Ryka**
   - Tipo de atividade: Onboarding
   - Prioridade: Medium
   - Status: Pendente

2. **Apresentação do Plano de Ação**
   - Tipo de atividade: Onboarding
   - Prioridade: Medium
   - Status: Pendente

---

## Implementação Técnica

Executarei 3 operações SQL via ferramenta de inserção:

```sql
-- 1. Criar evento de Onboarding
INSERT INTO events (account_id, title, description, event_type, modality, category)
VALUES ('796e7970-fd93-4574-a871-6090624cace6', 'Onboarding', 'Onboarding Inicial', 'live', 'online', 'operation')
RETURNING id;

-- 2. Vincular cliente ao evento
INSERT INTO event_participants (event_id, client_id)
VALUES (<event_id>, '45ebabf0-ed84-44d2-be23-18f8a9b8f979');

-- 3. Criar tarefas de onboarding
INSERT INTO internal_tasks (account_id, title, priority, client_id, activity_type_id)
VALUES 
  ('796e7970-fd93-4574-a871-6090624cace6', 'Implementação da Clínica Ryka', 'medium', '45ebabf0-ed84-44d2-be23-18f8a9b8f979', 'a2fd7380-58ab-42ac-8de1-66805e3004d0'),
  ('796e7970-fd93-4574-a871-6090624cace6', 'Apresentação do Plano de Ação', 'medium', '45ebabf0-ed84-44d2-be23-18f8a9b8f979', 'a2fd7380-58ab-42ac-8de1-66805e3004d0');
```

---

## Resultado Esperado

Após a execução:
1. ✅ Cliente Ariella Duarte terá um evento "Onboarding" na aba Agenda
2. ✅ Duas tarefas pendentes aparecerão na aba Tarefas (setor Operações)
3. ✅ Os itens seguirão o mesmo padrão da automação corrigida anteriormente

