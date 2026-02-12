

## Botoes de "Evento Concluido", "Evento Cancelado" e "Reabrir Evento"

### O que sera feito

Adicionar no canto superior direito da pagina de detalhes do evento:

- **Evento Em Aberto** (status default): dois botoes visiveis
  - "Evento Concluido" (verde, icone check) - marca como `completed`
  - "Evento Cancelado" (vermelho, icone alerta) - marca como `cancelled`

- **Evento Concluido ou Cancelado**: um unico botao
  - "Reabrir Evento" (cinza, icone de reabrir) - volta para `planned`

Quando concluido ou cancelado:
  - Botao "Editar" na aba Geral fica desabilitado
  - Acoes de adicionar participantes/convidar ficam desabilitadas
  - O status badge no header reflete o novo estado

### Detalhes tecnicos

**Arquivo: `src/pages/EventDetail.tsx`**

1. Adicionar funcao `handleChangeStatus(newStatus: string)` que faz `supabase.from("events").update({ status }).eq("id", id)` e chama `fetchEvent()` apos sucesso
2. No bloco de botoes do header (linha 272, `<div className="flex gap-2">`), adicionar:
   - Se `event.status` NAO for `completed` nem `cancelled`: renderizar botao verde "Evento Concluido" e botao vermelho "Evento Cancelado"
   - Se `event.status` FOR `completed` ou `cancelled`: renderizar botao cinza "Reabrir Evento"
3. Adicionar dialogo de confirmacao (AlertDialog) antes de executar a acao, com mensagem adequada para cada caso
4. Calcular `isLocked = event.status === 'completed' || event.status === 'cancelled'` e passar como prop para os componentes de tab que permitem edicao

**Arquivo: `src/components/events/EventOverviewTab.tsx`**

- Receber prop `isLocked?: boolean` e desabilitar o botao "Editar" quando `isLocked` for true

**Arquivo: `src/components/events/EventParticipantsTab.tsx`**

- Receber prop `isLocked?: boolean` e desabilitar botoes de adicionar/convidar participantes quando `isLocked` for true

### Fluxo visual

```text
Status "Em Aberto" (planned/draft/qualquer outro):
  [Evento Concluido (verde)]  [Evento Cancelado (vermelho)]

Status "Concluido" ou "Cancelado":
  [Reabrir Evento (cinza)]
```

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/EventDetail.tsx` | Botoes de status + funcao de update + AlertDialog de confirmacao + prop isLocked |
| `src/components/events/EventOverviewTab.tsx` | Prop isLocked para desabilitar edicao |
| `src/components/events/EventParticipantsTab.tsx` | Prop isLocked para desabilitar convites |

