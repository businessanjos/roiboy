
# Plano: Adicionar Campos de Data/Hora na Edição de Eventos da Aba Agenda

## Diagnóstico do Problema

Ao analisar o arquivo `src/components/client/ClientAgenda.tsx`, identifiquei que os campos de **Data/Hora** e **Duração** estão condicionados apenas ao tipo de evento `"live"`:

```typescript
// Linha 640 - Problema atual
{formData.event_type === "live" && (
  <>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label htmlFor="scheduled_at">Data/Hora</Label>
        <Input type="datetime-local" ... />
      </div>
      <div className="space-y-2">
        <Label htmlFor="duration">Duração (min)</Label>
        <Input type="number" ... />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor="meeting_url">Link da Reunião</Label>
      <Input ... />
    </div>
  </>
)}
```

Isso faz com que eventos do tipo "Material de Apoio", "Mentoria", "Workshop", etc., não exibam os campos de data/hora na edição, como mostrado no screenshot do usuário.

---

## Solução Proposta

Separar a lógica condicional:
1. **Data/Hora e Duração**: Disponíveis para TODOS os tipos de eventos (exceto "material")
2. **Link da Reunião**: Apenas para tipos de eventos que fazem sentido (lives, mentorias, webinars, etc.)
3. **Link do Material**: Apenas para tipo "material"

---

## Mudanças no Arquivo

**Arquivo:** `src/components/client/ClientAgenda.tsx`

### Antes (linhas 640-684):
```typescript
{formData.event_type === "live" && (
  <>
    <div className="grid grid-cols-2 gap-3">
      {/* Data/Hora e Duração */}
    </div>
    <div className="space-y-2">
      {/* Link da Reunião */}
    </div>
  </>
)}

{formData.event_type === "material" && (
  <div className="space-y-2">
    {/* Link do Material */}
  </div>
)}
```

### Depois:
```typescript
{/* Data/Hora e Duração - Disponível para todos os tipos exceto material */}
{formData.event_type !== "material" && (
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-2">
      <Label htmlFor="scheduled_at">Data/Hora</Label>
      <Input
        id="scheduled_at"
        type="datetime-local"
        value={formData.scheduled_at}
        onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="duration">Duração (min)</Label>
      <Input
        id="duration"
        type="number"
        value={formData.duration_minutes}
        onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
      />
    </div>
  </div>
)}

{/* Link da Reunião - Tipos que suportam reunião online */}
{["live", "mentoria", "workshop", "masterclass", "webinar", "imersao", "plantao"].includes(formData.event_type) && (
  <div className="space-y-2">
    <Label htmlFor="meeting_url">Link da Reunião</Label>
    <Input
      id="meeting_url"
      value={formData.meeting_url}
      onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
      placeholder="https://zoom.us/..."
    />
  </div>
)}

{/* Link do Material - Apenas para tipo material */}
{formData.event_type === "material" && (
  <div className="space-y-2">
    <Label htmlFor="material_url">Link do Material</Label>
    <Input
      id="material_url"
      value={formData.material_url}
      onChange={(e) => setFormData({ ...formData, material_url: e.target.value })}
      placeholder="https://..."
    />
  </div>
)}
```

---

## Fluxo Corrigido

| Tipo de Evento | Data/Hora | Duração | Link Reunião | Link Material |
|----------------|-----------|---------|--------------|---------------|
| Live | Sim | Sim | Sim | Nao |
| Mentoria | Sim | Sim | Sim | Nao |
| Workshop | Sim | Sim | Sim | Nao |
| Masterclass | Sim | Sim | Sim | Nao |
| Webinar | Sim | Sim | Sim | Nao |
| Imersao | Sim | Sim | Sim | Nao |
| Plantao | Sim | Sim | Sim | Nao |
| Material | Nao | Nao | Nao | Sim |
| Outros (campanha, viagem, etc.) | Sim | Sim | Nao | Nao |

---

## Resultado Esperado

Apos a correcao, ao editar qualquer evento que nao seja do tipo "material", o usuario vera os campos:
- **Data/Hora** (input datetime-local)
- **Duracao (min)** (input number)
- **Link da Reuniao** (quando aplicavel ao tipo)

Isso permitira editar a data e hora de mentorias, workshops, e qualquer outro tipo de evento agendavel.
