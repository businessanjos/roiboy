
# Plano: Encerramento de Confirmações de Presença (RSVP)

## Contexto

O sistema atual permite que participantes confirmem presença via link público (`/rsvp/:token`). No entanto, não existe controle sobre quando essas confirmações podem ser aceitas. O usuário precisa de:

1. **Encerramento manual** - Botão para fechar as confirmações imediatamente
2. **Encerramento automático** - Data/hora limite para aceitar confirmações
3. **Mensagem de encerramento** - Texto personalizado exibido quando encerrado

## Mudanças no Banco de Dados

### Novos campos na tabela `events`

```sql
ALTER TABLE public.events
ADD COLUMN rsvp_closed boolean NOT NULL DEFAULT false,
ADD COLUMN rsvp_deadline timestamptz,
ADD COLUMN rsvp_closure_message text;
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rsvp_closed` | boolean | Encerramento manual (toggle) |
| `rsvp_deadline` | timestamptz | Data/hora para encerramento automático |
| `rsvp_closure_message` | text | Mensagem personalizada para exibir |

### Atualização da função `get_participant_by_rsvp_token`

Adicionar os novos campos ao retorno para que o frontend saiba o status:

```sql
RETURNS TABLE (
  -- campos existentes...
  event_rsvp_closed boolean,
  event_rsvp_deadline timestamptz,
  event_rsvp_closure_message text
)
```

### Atualização da função `submit_rsvp_response`

Adicionar validação antes de aceitar a resposta:

```sql
-- Verificar se RSVP está encerrado
SELECT rsvp_closed, rsvp_deadline INTO v_rsvp_closed, v_rsvp_deadline
FROM events WHERE id = v_event_id;

IF v_rsvp_closed OR (v_rsvp_deadline IS NOT NULL AND now() > v_rsvp_deadline) THEN
  RETURN jsonb_build_object(
    'success', false, 
    'error', 'As confirmações para este evento foram encerradas.'
  );
END IF;
```

## Mudanças na Interface

### 1. EventEditDialog (`src/components/events/EventEditDialog.tsx`)

Adicionar seção "Confirmações de Presença" com:

```text
┌─────────────────────────────────────────────────────────┐
│ Confirmações de Presença                                │
├─────────────────────────────────────────────────────────┤
│ [Toggle] Encerrar confirmações manualmente              │
│                                                         │
│ Encerramento automático:                                │
│ [📅 ___________ ] [🕐 ___:___ ]  (opcional)             │
│                                                         │
│ Mensagem ao encerrar: (opcional)                        │
│ [________________________________]                      │
│ [________________________________]                      │
└─────────────────────────────────────────────────────────┘
```

**Novos estados:**
```typescript
const [rsvpClosed, setRsvpClosed] = useState(false);
const [rsvpDeadline, setRsvpDeadline] = useState("");
const [rsvpClosureMessage, setRsvpClosureMessage] = useState("");
```

**Atualização na interface EventData:**
```typescript
export interface EventData {
  // ... campos existentes
  rsvp_closed?: boolean;
  rsvp_deadline?: string | null;
  rsvp_closure_message?: string | null;
}
```

### 2. PublicRSVP (`src/pages/PublicRSVP.tsx`)

**Atualização na interface RSVPData:**
```typescript
interface RSVPData {
  // ... campos existentes
  event_rsvp_closed: boolean;
  event_rsvp_deadline: string | null;
  event_rsvp_closure_message: string | null;
}
```

**Lógica de verificação:**
```typescript
const isRsvpClosed = () => {
  if (data?.event_rsvp_closed) return true;
  if (data?.event_rsvp_deadline && new Date(data.event_rsvp_deadline) < new Date()) {
    return true;
  }
  return false;
};
```

**Nova tela quando encerrado:**
```text
┌─────────────────────────────────────┐
│            ⏰                       │
│                                     │
│    Confirmações Encerradas          │
│                                     │
│    [Mensagem personalizada ou       │
│     mensagem padrão]                │
│                                     │
│    ─────────────────────────────    │
│    Evento: [Nome do Evento]         │
│    📅 15 de Janeiro, 2026           │
│    🕐 19:00 - 22:00                 │
└─────────────────────────────────────┘
```

## Arquivos a Modificar

1. **Nova migração SQL**
   - Adicionar colunas `rsvp_closed`, `rsvp_deadline`, `rsvp_closure_message`
   - Atualizar função `get_participant_by_rsvp_token`
   - Atualizar função `submit_rsvp_response`

2. **`src/components/events/EventEditDialog.tsx`**
   - Adicionar estados para os novos campos
   - Adicionar seção no formulário com Switch + DateTimePicker + Textarea
   - Incluir campos na mutation de update

3. **`src/pages/PublicRSVP.tsx`**
   - Atualizar interface RSVPData
   - Adicionar função `isRsvpClosed()`
   - Renderizar tela de encerramento quando aplicável

## Detalhes Técnicos

### Componentes UI a utilizar

- `Switch` do shadcn/ui para o toggle de encerramento manual
- `Input type="datetime-local"` para a data/hora limite
- `Textarea` para a mensagem personalizada
- Ícone `Clock` ou `CalendarOff` do lucide-react para a tela de encerrado

### Mensagem padrão

Se `rsvp_closure_message` estiver vazio, exibir:
> "As confirmações de presença para este evento foram encerradas. Para mais informações, entre em contato com o organizador."

### Validação de deadline

- Se `rsvp_deadline` for preenchido, deve ser uma data futura
- O campo só deve ser editável se `rsvp_closed` for `false`
- Mostrar contagem regressiva ou "Encerra em X dias" na UI do evento

## Fluxo do Usuário

```text
Organizador                                  Participante
    │                                              │
    ├──► Cria evento                               │
    │                                              │
    ├──► Envia links de RSVP ─────────────────────►│
    │                                              │
    │    [Opcional] Define deadline automático     │
    │    Ex: 3 dias antes do evento                │
    │                                              ├──► Acessa link
    │                                              │    ✓ Confirma/Declina
    ├──► Após deadline ou toggle manual            │
    │                                              │
    │                                              ├──► Acessa link
    │                                              │    ✗ "Confirmações encerradas"
    │                                              │
```

## Impacto

- **Controle total**: Organizador decide quando parar de aceitar confirmações
- **Automação**: Deadline automático evita esquecimentos
- **UX clara**: Mensagem personalizada informa o participante
- **Segurança**: Validação no backend (RPC) garante que ninguém consiga confirmar após encerramento
