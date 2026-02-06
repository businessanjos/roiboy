
# Plano: Agenda do Mentor com Vinculação de Eventos

## Visão Geral

Criar uma agenda dedicada ao setor Mentor (id: "diretoria") com visualização mensal/anual no estilo do Marketing, adicionar um campo "Vincular Mentor" na criação/edição de eventos na Operação, e implementar notificações automáticas para eventos vinculados.

---

## Arquitetura da Solução

### 1. Alterações no Banco de Dados

**Nova coluna na tabela `events`:**
```sql
ALTER TABLE events ADD COLUMN mentor_user_id uuid REFERENCES users(id);
```

Esta coluna armazena o ID do mentor vinculado ao evento (inicialmente apenas Everton Pieri).

---

### 2. Nova Página: Agenda do Mentor

**Arquivo:** `src/pages/MentorAgenda.tsx`

Estrutura com 3 abas:
- **Calendário** (visão mensal/anual igual ao Marketing)
- **Eventos** (lista de todos os eventos vinculados ao mentor)
- **Lembretes** (histórico de notificações e lembretes do mentor)

A página filtra eventos onde `mentor_user_id` é igual ao ID do mentor logado (ou ao Everton Pieri para admins visualizando).

---

### 3. Atualização do Setor Mentor

**Arquivo:** `src/config/sectors.ts`

Adicionar rota `/mentor-agenda` ao setor "diretoria":
```typescript
{
  id: "diretoria",
  name: "Mentor",
  // ...
  navItems: [
    { to: "/mentor-agenda", icon: CalendarDays, label: "Agenda" },  // NOVO
    { to: "/roy-zapp", icon: MessageSquare, label: "ROY zAPP" },
    { to: "/notifications", icon: Bell, label: "Notificações" },
  ],
}
```

---

### 4. Atualização do EventEditDialog (Operação)

**Arquivo:** `src/components/events/EventEditDialog.tsx`

Adicionar campo "Vincular Mentor":
```typescript
<div className="space-y-2">
  <Label>Vincular Mentor</Label>
  <Select value={mentorUserId} onValueChange={setMentorUserId}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione um mentor" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">Nenhum</SelectItem>
      <SelectItem value="de43a643-0109-4afb-ac35-be768dbf4090">
        Everton Pieri
      </SelectItem>
    </SelectContent>
  </Select>
</div>
```

O ID `de43a643-0109-4afb-ac35-be768dbf4090` corresponde ao Everton Pieri no banco.

---

### 5. Sistema de Notificações Automáticas

**Atualização do Edge Function:** `check-agenda-reminders`

Adicionar duas novas verificações:
1. **Lembrete 1 dia antes:** Notificar mentor quando faltar 1 dia para o evento
2. **Lembrete no dia:** Notificar mentor no dia do evento

```typescript
// 5. MENTOR EVENTS - 1 DAY BEFORE
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split("T")[0];

const { data: mentorEventsTomorrow } = await supabase
  .from("events")
  .select("id, title, account_id, scheduled_at, mentor_user_id")
  .gte("scheduled_at", `${tomorrowStr}T00:00:00`)
  .lt("scheduled_at", `${tomorrowStr}T23:59:59`)
  .not("mentor_user_id", "is", null);

for (const event of mentorEventsTomorrow || []) {
  await createNotification(supabase, {
    accountId: event.account_id,
    userId: event.mentor_user_id,
    type: "mentor_event_tomorrow",
    title: "🔔 Evento amanhã",
    content: `${event.title} está agendado para amanhã`,
    link: `/events/${event.id}`,
    sourceType: "events",
    sourceId: event.id,
  });
}

// 6. MENTOR EVENTS - TODAY
const { data: mentorEventsToday } = await supabase
  .from("events")
  .select("id, title, account_id, scheduled_at, mentor_user_id")
  .gte("scheduled_at", `${today}T00:00:00`)
  .lt("scheduled_at", `${today}T23:59:59`)
  .not("mentor_user_id", "is", null);

for (const event of mentorEventsToday || []) {
  await createNotification(supabase, {
    accountId: event.account_id,
    userId: event.mentor_user_id,
    type: "mentor_event_today",
    title: "📅 Evento hoje!",
    content: `${event.title} às ${formatTime(event.scheduled_at)}`,
    link: `/events/${event.id}`,
    sourceType: "events",
    sourceId: event.id,
  });
}
```

---

### 6. Componentes a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/MentorAgenda.tsx` | Página principal da agenda do mentor |
| `src/components/mentor/MentorEventsTab.tsx` | Aba de listagem de eventos |
| `src/components/mentor/MentorRemindersTab.tsx` | Aba de lembretes |
| `src/hooks/useMentorEvents.tsx` | Hook para buscar eventos vinculados ao mentor |

---

### 7. Fluxo de Vinculação

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Usuário cria/edita evento na Operação                                │
│    ↓                                                                     │
│ 2. Seleciona "Everton Pieri" no campo "Vincular Mentor"                 │
│    ↓                                                                     │
│ 3. mentor_user_id é salvo na tabela events                              │
│    ↓                                                                     │
│ 4. Evento aparece automaticamente na Agenda do Mentor                   │
│    ↓                                                                     │
│ 5. pg_cron dispara check-agenda-reminders diariamente às 08:00 BRT      │
│    ↓                                                                     │
│ 6. Notificações são enviadas:                                            │
│    - 1 dia antes do evento                                               │
│    - No dia do evento                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 8. Rotas a Adicionar

**Arquivo:** `src/App.tsx`

```typescript
const MentorAgenda = lazy(() => import("./pages/MentorAgenda"));

// Dentro das rotas protegidas:
<Route path="/mentor-agenda" element={<MentorAgenda />} />
```

---

## Arquivos a Modificar

| Arquivo | Modificações |
|---------|--------------|
| `src/config/sectors.ts` | Adicionar rota `/mentor-agenda` ao setor diretoria |
| `src/App.tsx` | Adicionar rota para MentorAgenda |
| `src/components/events/EventEditDialog.tsx` | Campo "Vincular Mentor" |
| `src/pages/Events.tsx` | Campo "Vincular Mentor" no dialog de criação |
| `supabase/functions/check-agenda-reminders/index.ts` | Notificações do mentor |

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/MentorAgenda.tsx` | Página da agenda (calendário + eventos + lembretes) |
| `src/hooks/useMentorEvents.tsx` | Hook para eventos do mentor |

---

## Migração de Banco de Dados

```sql
-- Adicionar coluna para vincular mentor ao evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS mentor_user_id uuid REFERENCES users(id);

-- Index para performance nas consultas por mentor
CREATE INDEX IF NOT EXISTS idx_events_mentor_user_id ON events(mentor_user_id);
```

---

## Comportamento Esperado

1. **No setor Operação:** Ao criar/editar evento, o campo "Vincular Mentor" aparece com a opção "Everton Pieri"
2. **No setor Mentor:** A aba "Agenda" exibe calendário mensal/anual com todos os eventos vinculados
3. **Notificações automáticas:**
   - 1 dia antes: "🔔 Evento amanhã - [Título do Evento]"
   - No dia: "📅 Evento hoje! - [Título do Evento] às HH:mm"
4. **Aba Eventos:** Lista todos os eventos com filtros e busca
5. **Aba Lembretes:** Histórico de notificações enviadas ao mentor

---

## Notas Técnicas

### ID do Everton Pieri
O ID fixo `de43a643-0109-4afb-ac35-be768dbf4090` será usado inicialmente. No futuro, pode ser expandido para buscar mentores dinamicamente de uma tabela.

### Reutilização de Componentes
Os componentes `MonthlyCalendarView` e `YearlyCalendarView` do Marketing serão reutilizados, passando eventos filtrados por `mentor_user_id`.

### Timezone
Todas as notificações seguem o timezone de São Paulo (America/Sao_Paulo), conforme já implementado no `check-agenda-reminders`.
