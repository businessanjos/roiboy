
## Sincronizar alteracoes de data/hora da tarefa com o Google Calendar

### Diagnostico

Atualmente, quando uma reuniao e criada (via Zoom ou Google Meet), o sistema:

1. Cria a reuniao na plataforma escolhida
2. Registra o evento no Google Calendar do vendedor
3. Salva apenas `meeting_url` e `meeting_platform` na tarefa (`internal_tasks`)

O problema: **nao e armazenado o ID do evento do Google Calendar** na tarefa. Sem esse ID, e impossivel atualizar o evento posteriormente. Alem disso, **nao existe nenhuma funcao que atualize o calendario quando a tarefa e editada** -- simplesmente nao ha essa logica hoje.

### Solucao

A correcao envolve 3 etapas:

**1. Armazenar o ID do evento do Google Calendar na tarefa**

- Adicionar coluna `google_calendar_event_id` na tabela `internal_tasks`
- Modificar a Edge Function `create-meeting` para salvar o ID do evento do calendario retornado pela API do Google

**2. Criar Edge Function `update-meeting`**

- Nova funcao que recebe `task_id`, `start_time`, `end_time` e `title`
- Busca o `google_calendar_event_id` e `assigned_to` da tarefa
- Obtem os tokens Google do usuario via `user_integrations`
- Chama a Google Calendar API (PATCH) para atualizar data/hora do evento
- Se a reuniao for Zoom, tambem atualiza a reuniao via Zoom API

**3. Chamar a funcao ao editar data/hora da tarefa**

- No `TaskDialog.tsx`, ao salvar uma tarefa que possui `meeting_url`, detectar se `due_date` ou `due_time` mudaram
- Se mudaram, chamar a funcao `update-meeting` para sincronizar

### Alteracoes detalhadas

**Migracao de banco de dados:**
- Adicionar coluna `google_calendar_event_id TEXT` na tabela `internal_tasks`
- Adicionar coluna `zoom_meeting_id TEXT` na tabela `internal_tasks`

**Edge Function `create-meeting/index.ts`:**
- Salvar o `eventData.id` (Google Calendar) e `meetingData.id` (Zoom) na tarefa ao lado do `meeting_url`

**Nova Edge Function `update-meeting/index.ts`:**
- Recebe: `task_id`, `start_time`, `end_time`, `title` (opcional)
- Busca tarefa para obter `google_calendar_event_id`, `zoom_meeting_id`, `meeting_platform`, `assigned_to`
- Se tiver `google_calendar_event_id`: atualiza via Google Calendar API (PATCH `/calendars/primary/events/{eventId}`)
- Se tiver `zoom_meeting_id`: atualiza via Zoom API (PATCH `/meetings/{meetingId}`)
- Retorna sucesso/erro

**`src/components/tasks/TaskDialog.tsx`:**
- Ao salvar uma tarefa com `meeting_url`, comparar `due_date` e `due_time` com os valores originais
- Se houver mudanca, chamar `update-meeting` com os novos horarios
- Exibir toast de confirmacao ("Calendario atualizado") ou erro

### Fluxo apos a correcao

```text
Usuario edita data/hora da tarefa de reuniao
  -> TaskDialog detecta mudanca de horario + meeting_url presente
  -> Chama Edge Function update-meeting
  -> update-meeting busca IDs do calendario/zoom na tarefa
  -> Atualiza Google Calendar via API (PATCH)
  -> Atualiza Zoom via API (PATCH), se aplicavel
  -> Usuario ve toast de confirmacao
```

### Observacoes

- A sincronizacao e bidirecional apenas do ROY para o Google/Zoom (nao o contrario)
- Se o usuario nao tiver Google conectado, a atualizacao do calendario e ignorada silenciosamente
- Reunioes criadas antes desta implementacao nao terao os IDs armazenados, portanto nao serao sincronizaveis (comportamento gracioso sem erro)
