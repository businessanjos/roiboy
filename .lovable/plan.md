
# Plano: Adicionar Controles de Encerramento na Seção RSVP

## O Problema

A funcionalidade de encerrar confirmações foi implementada apenas no `EventEditDialog.tsx` (o diálogo que aparece ao editar evento da lista geral). Porém, você está usando a **página de detalhes do evento** (`/events/:id`), onde a seção RSVP está localizada no componente `EventOverviewTab.tsx` — e lá não tem esses controles.

## Solução

Adicionar os controles de encerramento diretamente na seção RSVP da página de detalhes do evento, logo abaixo do link e código de inscrição.

## Arquivos a Modificar

### 1. `src/pages/EventDetail.tsx`

**Atualizar a interface `Event`** para incluir os novos campos:

```typescript
interface Event {
  // ... campos existentes
  rsvp_closed: boolean;
  rsvp_deadline: string | null;
  rsvp_closure_message: string | null;
}
```

### 2. `src/components/events/EventOverviewTab.tsx`

**Atualizar a interface `Event`** local para incluir os mesmos campos:

```typescript
interface Event {
  // ... campos existentes
  rsvp_closed?: boolean;
  rsvp_deadline?: string | null;
  rsvp_closure_message?: string | null;
}
```

**Adicionar imports necessários:**
```typescript
import { Switch } from "@/components/ui/switch";
import { CalendarOff } from "lucide-react";
```

**Adicionar estados para controle:**
```typescript
const [rsvpClosed, setRsvpClosed] = useState(event.rsvp_closed ?? false);
const [rsvpDeadline, setRsvpDeadline] = useState(event.rsvp_deadline || "");
const [rsvpClosureMessage, setRsvpClosureMessage] = useState(event.rsvp_closure_message || "");
const [savingRsvpSettings, setSavingRsvpSettings] = useState(false);
```

**Adicionar função para salvar configurações RSVP:**
```typescript
const saveRsvpSettings = async () => {
  setSavingRsvpSettings(true);
  try {
    const { error } = await supabase
      .from("events")
      .update({
        rsvp_closed: rsvpClosed,
        rsvp_deadline: rsvpDeadline || null,
        rsvp_closure_message: rsvpClosureMessage || null,
      })
      .eq("id", event.id);
    
    if (error) throw error;
    toast.success("Configurações de RSVP salvas!");
    onUpdate();
  } catch (error) {
    toast.error("Erro ao salvar configurações");
  } finally {
    setSavingRsvpSettings(false);
  }
};
```

**Adicionar seção de controles RSVP** (após a linha 389, dentro do card RSVP):

```tsx
{/* RSVP Closure Controls */}
{event.public_registration_code && (
  <div className="mt-6 pt-6 border-t space-y-4">
    <div className="flex items-center gap-2 mb-3">
      <CalendarOff className="h-4 w-4 text-muted-foreground" />
      <Label className="font-medium">Controle de Confirmações</Label>
    </div>
    
    {/* Toggle encerrar manualmente */}
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="text-sm">Encerrar confirmações</Label>
        <p className="text-xs text-muted-foreground">
          {rsvpClosed 
            ? "Link bloqueado - ninguém pode confirmar" 
            : "Link ativo - confirmações abertas"}
        </p>
      </div>
      <Switch
        checked={rsvpClosed}
        onCheckedChange={setRsvpClosed}
      />
    </div>

    {/* Data limite automática */}
    {!rsvpClosed && (
      <div className="space-y-2">
        <Label className="text-sm">Encerrar automaticamente em:</Label>
        <Input
          type="datetime-local"
          value={rsvpDeadline}
          onChange={(e) => setRsvpDeadline(e.target.value)}
          className="max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          Após esta data, novas confirmações serão bloqueadas
        </p>
      </div>
    )}

    {/* Mensagem de encerramento */}
    <div className="space-y-2">
      <Label className="text-sm">Mensagem quando encerrado (opcional)</Label>
      <Textarea
        value={rsvpClosureMessage}
        onChange={(e) => setRsvpClosureMessage(e.target.value)}
        placeholder="Ex: As confirmações foram encerradas..."
        rows={2}
      />
    </div>

    {/* Botão salvar */}
    <Button 
      onClick={saveRsvpSettings} 
      disabled={savingRsvpSettings}
      size="sm"
    >
      {savingRsvpSettings ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Salvando...
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </>
      )}
    </Button>
  </div>
)}
```

## Resultado Visual

Após a implementação, a seção RSVP ficará assim:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🔗 RSVP                                                     │
│ Compartilhe este link para inscrição                        │
├─────────────────────────────────────────────────────────────┤
│ [ https://...lovable.app/inscricao/RSV006 ]  [📋 Copiar]   │
│                                                             │
│ Código: RSV006    🔄 Gerar novo código                      │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│ 🚫 Controle de Confirmações                                 │
│                                                             │
│ Encerrar confirmações              ○─────────○ [Toggle]    │
│ Link ativo - confirmações abertas                           │
│                                                             │
│ Encerrar automaticamente em:                                │
│ [ 📅 ___/___/_____  🕐 __:__ ]                             │
│ Após esta data, novas confirmações serão bloqueadas         │
│                                                             │
│ Mensagem quando encerrado (opcional):                       │
│ [_________________________________________________]         │
│ [_________________________________________________]         │
│                                                             │
│ [ 💾 Salvar Configurações ]                                 │
│ ─────────────────────────────────────────────────────────── │
│ Arquivo do Convite (opcional)                               │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

## Status Visual do RSVP

Quando encerrado (manual ou por deadline), mostrar badge visual:

```tsx
{(rsvpClosed || (rsvpDeadline && new Date(rsvpDeadline) < new Date())) && (
  <Badge variant="destructive" className="ml-2">
    Encerrado
  </Badge>
)}
```

## Resumo das Mudanças

| Arquivo | Alteração |
|---------|-----------|
| `EventDetail.tsx` | Adicionar campos RSVP na interface `Event` |
| `EventOverviewTab.tsx` | Adicionar interface atualizada, estados, função de save, e UI de controles |

## Notas Técnicas

- Os campos já existem no banco de dados (migração anterior)
- A query `select("*")` já traz todos os campos automaticamente
- A validação no backend (RPC `submit_rsvp_response`) já bloqueia confirmações quando encerrado
- A página pública (`PublicRSVP.tsx`) já mostra a mensagem de encerramento
