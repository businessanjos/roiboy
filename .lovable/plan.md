
# Sistema de Notificações para Agenda (Tarefas e Eventos)

## Objetivo
Implementar um sistema de notificações automáticas que alerta os responsáveis sobre:
1. **Lembretes do dia**: Quando chega a data de uma tarefa/evento
2. **Alertas de atraso**: Quando uma tarefa/evento passa da data limite sem ser concluído

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────┐
│                    CRON (diário/horário)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Edge Function: check-agenda-reminders              │
│                                                              │
│  1. Busca tarefas com due_date = HOJE e status ≠ done       │
│  2. Busca tarefas com due_date < HOJE e status ≠ done       │
│  3. Busca eventos com scheduled_at = HOJE                    │
│  4. Busca eventos com scheduled_at < HOJE (não realizados)  │
│  5. Cria notificações para os responsáveis                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tabela: notifications                     │
│    (INSERT dispara realtime → toast + push no browser)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Regras de Notificação

### 1. Tarefas (`internal_tasks`)

| Situação | Condição | Notificação |
|----------|----------|-------------|
| **Lembrete do dia** | `due_date = hoje` AND `status NOT IN ('done', 'cancelled')` | "⏰ Tarefa para hoje: {título}" |
| **Atrasada** | `due_date < hoje` AND `status NOT IN ('done', 'cancelled')` | "⚠️ Tarefa atrasada: {título}" |

**Destinatário**: `assigned_to` (responsável pela tarefa)
- Se não houver responsável atribuído, notifica `created_by`

### 2. Eventos (`events` + `event_team`)

| Situação | Condição | Notificação |
|----------|----------|-------------|
| **Lembrete do dia** | `scheduled_at::date = hoje` | "📅 Evento hoje: {título}" |
| **Atrasado/Não realizado** | `scheduled_at::date < hoje` AND `status != 'completed'` | "⚠️ Evento não realizado: {título}" |

**Destinatário**: Membros da equipe do evento (`event_team.user_id`)
- Prioridade para `is_primary = true`
- Se não houver equipe, não notifica (evento sem responsável)

---

## Implementação Detalhada

### Arquivo 1: Edge Function `supabase/functions/check-agenda-reminders/index.ts`

```typescript
// Pseudocódigo da lógica principal:

async function checkAgendaReminders() {
  const today = new Date().toISOString().split('T')[0];
  
  // 1. TAREFAS PARA HOJE
  const { data: todayTasks } = await supabase
    .from('internal_tasks')
    .select('id, title, assigned_to, created_by, client_id, account_id, clients(full_name)')
    .eq('due_date', today)
    .not('status', 'in', '("done","cancelled")');
  
  for (const task of todayTasks) {
    await createNotification({
      type: 'task_due_today',
      title: '⏰ Tarefa para hoje',
      content: `${task.title}${task.clients?.full_name ? ` - ${task.clients.full_name}` : ''}`,
      user_id: task.assigned_to || task.created_by,
      link: task.client_id ? `/clients/${task.client_id}` : '/tasks',
      source_type: 'internal_tasks',
      source_id: task.id,
    });
  }
  
  // 2. TAREFAS ATRASADAS
  const { data: overdueTasks } = await supabase
    .from('internal_tasks')
    .select('id, title, assigned_to, created_by, client_id, account_id, due_date, clients(full_name)')
    .lt('due_date', today)
    .not('status', 'in', '("done","cancelled")');
  
  for (const task of overdueTasks) {
    await createNotification({
      type: 'task_overdue',
      title: '⚠️ Tarefa atrasada',
      content: `${task.title} - Venceu em ${formatDate(task.due_date)}`,
      user_id: task.assigned_to || task.created_by,
      // ...
    });
  }
  
  // 3. EVENTOS PARA HOJE
  const { data: todayEvents } = await supabase
    .from('events')
    .select('id, title, account_id, scheduled_at')
    .gte('scheduled_at', `${today}T00:00:00`)
    .lt('scheduled_at', `${today}T23:59:59`);
  
  for (const event of todayEvents) {
    // Buscar membros da equipe
    const { data: teamMembers } = await supabase
      .from('event_team')
      .select('user_id')
      .eq('event_id', event.id);
    
    for (const member of teamMembers) {
      await createNotification({
        type: 'event_today',
        title: '📅 Evento hoje',
        content: `${event.title} às ${formatTime(event.scheduled_at)}`,
        user_id: member.user_id,
        link: `/events/${event.id}`,
        source_type: 'events',
        source_id: event.id,
      });
    }
  }
  
  // 4. EVENTOS ATRASADOS (opcional - depende do workflow)
}
```

### Arquivo 2: Configuração CRON

A edge function será chamada por um cron externo ou via pg_cron. Sugestão: executar a cada 6 horas ou 1x por dia às 8h.

### Arquivo 3: `supabase/config.toml` (atualizar)

```toml
[functions.check-agenda-reminders]
verify_jwt = false
```

---

## Controle de Duplicatas

Para evitar notificações duplicadas no mesmo dia:

```typescript
// Antes de criar notificação, verificar se já existe
const notificationKey = `${type}-${source_id}-${today}`;

const { data: existing } = await supabase
  .from('notifications')
  .select('id')
  .eq('user_id', userId)
  .eq('source_type', sourceType)
  .eq('source_id', sourceId)
  .eq('type', type)
  .gte('created_at', `${today}T00:00:00`)
  .limit(1);

if (existing?.length) {
  console.log('Notification already sent today, skipping...');
  continue;
}
```

---

## Tipos de Notificação a Adicionar

| Tipo | Título | Contexto |
|------|--------|----------|
| `task_due_today` | ⏰ Tarefa para hoje | Tarefa com vencimento hoje |
| `task_overdue` | ⚠️ Tarefa atrasada | Tarefa passou da data limite |
| `event_today` | 📅 Evento hoje | Evento agendado para hoje |
| `event_overdue` | ⚠️ Evento não realizado | Evento passou da data sem conclusão |

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/check-agenda-reminders/index.ts` | **Criar** - Lógica principal |
| `supabase/config.toml` | **Modificar** - Adicionar config da function |

---

## Fluxo do Usuário

1. Usuário cria tarefa com data de vencimento
2. CRON executa `check-agenda-reminders` diariamente
3. Sistema verifica tarefas/eventos do dia e atrasados
4. Cria notificações na tabela `notifications`
5. Realtime dispara para o frontend
6. Usuário recebe toast + push notification (se permitido)
7. Ao clicar, navega para o cliente/tarefa/evento

---

## Considerações Técnicas

1. **Performance**: A função deve processar por batches se houver muitos registros
2. **Timezone**: Usar timezone do Brasil (America/Sao_Paulo) para determinar "hoje"
3. **Deduplicação**: Verificar se notificação já foi enviada hoje antes de criar nova
4. **Fallback de responsável**: Se tarefa não tem `assigned_to`, notificar `created_by`
5. **Eventos sem equipe**: Não gera notificação se evento não tem membros em `event_team`
