
# Plano: Persistência do Link de Reunião + Registro no Histórico

## Resumo do Problema

1. **Link desaparece ao reabrir tarefa**: As queries que buscam tarefas não incluem `meeting_url` e `meeting_platform`
2. **Sem registro no histórico do deal**: Quando uma reunião é criada, não há anotação automática no histórico do negócio

---

## Análise Técnica

### Causa Raiz 1: Campos Ausentes nas Queries

Os seguintes arquivos buscam tarefas sem incluir `meeting_url` e `meeting_platform`:

| Arquivo | Problema |
|---------|----------|
| `src/components/sales/DealActivitiesTab.tsx` | Query não inclui `meeting_url`, `meeting_platform` |
| `src/pages/Tasks.tsx` | Query usa `*` mas interface Task não inclui os campos |
| `src/components/sales/DealDetailSheet.tsx` | Query para timeline não inclui os campos |

### Causa Raiz 2: Falta de Registro no Histórico

A edge function `create-meeting` apenas atualiza a tarefa com o link, mas não cria uma entrada em `deal_activities` para registrar o evento no histórico do negócio.

---

## Solução Proposta

### Parte 1: Corrigir Persistência do Link

#### Mudança 1.1: DealActivitiesTab.tsx
Adicionar `meeting_url` e `meeting_platform` na query e interface:

```typescript
interface Task {
  // ... campos existentes
  meeting_url?: string | null;
  meeting_platform?: string | null;
}

// Na query:
.select(`
  id,
  title,
  // ... outros campos
  meeting_url,
  meeting_platform,
  // ... joins
`)
```

#### Mudança 1.2: Tasks.tsx
A query usa `*` então os campos já vêm, mas a interface precisa ser atualizada:

```typescript
interface Task {
  // ... campos existentes
  meeting_url?: string | null;
  meeting_platform?: string | null;
  completed_at?: string | null;
  activity_type_id?: string | null;
}
```

#### Mudança 1.3: DealDetailSheet.tsx
Adicionar os campos na query da timeline de tarefas (se necessário para exibição).

---

### Parte 2: Registrar Link no Histórico do Negócio

#### Mudança 2.1: Edge Function create-meeting
Após criar a reunião com sucesso, inserir uma atividade no histórico do deal:

```typescript
// Após atualizar a tarefa com o meeting_url...

// Registrar no histórico do negócio (se deal_id existir)
if (task.deal_id) {
  // Buscar nome do vendedor responsável
  const { data: assignedUser } = await supabase
    .from("users")
    .select("name")
    .eq("id", task.assigned_to || task.created_by)
    .single();

  // Criar atividade no histórico
  await supabase.from("deal_activities").insert({
    account_id: task.account_id,
    deal_id: task.deal_id,
    type: "meeting",
    title: `🔗 Reunião ${platform === 'zoom' ? 'Zoom' : 'Google Meet'} Agendada`,
    content: `**Vendedor:** ${assignedUser?.name || 'Não identificado'}
**Data:** ${format(startDate, "dd/MM/yyyy 'às' HH:mm")}
**Link da Reunião:** [Clique para entrar](${meetingResult.meeting_url})`,
    user_id: task.assigned_to || task.created_by,
  });
}
```

#### Mudança 2.2: Exibição do Link na Timeline
O componente `DealDetailSheet` já exibe atividades do tipo "meeting" com ícone de vídeo. O conteúdo com markdown será renderizado corretamente.

---

### Parte 3: Feedback de Sucesso/Falha

A edge function já retorna sucesso/erro, e o `MeetingConfigDialog` já exibe toasts apropriados:
- ✅ `toast.success("Reunião criada com sucesso!")` já existe
- ✅ `toast.error(error.message)` já existe para falhas

Melhorar a mensagem de sucesso para ser mais informativa:

```typescript
// Em MeetingConfigDialog.tsx
toast.success(
  task.deal_id 
    ? "Reunião criada e registrada no histórico do negócio!" 
    : "Reunião criada com sucesso!"
);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/sales/DealActivitiesTab.tsx` | Adicionar `meeting_url`, `meeting_platform` na query e interface |
| `src/pages/Tasks.tsx` | Adicionar campos na interface Task |
| `src/components/tasks/TaskDialog.tsx` | Interface Task já tem os campos - verificar se props são passadas corretamente |
| `supabase/functions/create-meeting/index.ts` | Adicionar insert em `deal_activities` com link da reunião |
| `src/components/tasks/MeetingConfigDialog.tsx` | Melhorar mensagem de sucesso |

---

## Resultado Esperado

1. **Persistência**: Ao reabrir a tarefa, o link da reunião estará visível
2. **Histórico**: Uma anotação automática aparece no histórico do negócio com:
   - Nome do vendedor responsável
   - Data e horário da reunião
   - Link clicável para a reunião
3. **Feedback**: Mensagem de sucesso confirma criação e registro no histórico
4. **Consistência**: Link disponível tanto na tarefa quanto no histórico do deal
