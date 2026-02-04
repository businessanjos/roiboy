
# Plano: Corrigir Diferença de 3 Horas nas Reuniões Zoom

## Problema Identificado

O usuário agenda uma reunião para **13:00** no ROY, mas ela aparece às **16:00** no Zoom. Isso ocorre porque:

1. O código cria corretamente a data como horário local (13:00 BRT)
2. Usa `toISOString()` que converte para UTC (16:00 UTC)
3. Envia para a Edge Function como "2026-01-21T16:00:00.000Z"
4. A API do Zoom recebe o horário UTC e aplica o timezone `America/Sao_Paulo` novamente

```text
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO ATUAL (COM BUG)                                          │
├─────────────────────────────────────────────────────────────────┤
│  ROY (13:00 local) → toISOString() → 16:00 UTC → Zoom API       │
│                                                        ↓        │
│                              Zoom aplica timezone → 19:00 BRT   │
│                              (ou interpreta como 16:00 local)   │
└─────────────────────────────────────────────────────────────────┘
```

## Solucao

Enviar o horario no formato ISO **sem** conversao para UTC, mantendo os componentes locais. A API do Zoom aceita o formato `YYYY-MM-DDTHH:mm:ss` junto com o campo `timezone` para interpretar corretamente.

```text
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO CORRIGIDO                                                │
├─────────────────────────────────────────────────────────────────┤
│  ROY (13:00 local) → formato local → 2026-01-21T13:00:00        │
│                                                        ↓        │
│                    Zoom API + timezone: America/Sao_Paulo       │
│                                                        ↓        │
│                              Resultado: 13:00 BRT (correto!)    │
└─────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

### 1. `src/components/tasks/MeetingConfigDialog.tsx`

**Problema:** Linhas 172-173 usam `toISOString()` que converte para UTC.

**Modificacao:** Criar uma funcao auxiliar que formata a data em componentes locais sem conversao UTC.

**Antes:**
```tsx
start_time: startDate.toISOString(),
end_time: endDate.toISOString(),
```

**Depois:**
```tsx
// Helper function to format date as local ISO string (without UTC conversion)
const formatLocalISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

// Na chamada da Edge Function:
start_time: formatLocalISOString(startDate),
end_time: formatLocalISOString(endDate),
```

### 2. `supabase/functions/create-meeting/index.ts`

A Edge Function ja configura `timezone: "America/Sao_Paulo"` na requisicao do Zoom (linha 155), entao ela esta preparada para receber horarios locais. Nao precisa de alteracao na logica do Zoom.

**Verificar:** O mesmo comportamento se aplica ao Google Meet (linhas 310-311). Ambas as APIs usam o campo `timeZone` para interpretar o horario.

## Detalhes Tecnicos

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Formato enviado | `2026-01-21T16:00:00.000Z` (UTC) | `2026-01-21T13:00:00` (local) |
| Interpretacao Zoom | UTC + timezone = erro | Local + timezone = correto |
| Compatibilidade | N/A | Google Meet tambem funciona |

## Alternativa Considerada

Outra opcao seria ajustar a Edge Function para converter UTC de volta para local antes de enviar ao Zoom. Porem, a solucao escolhida (enviar horario local desde o frontend) e mais simples e segue o padrao ja usado em `dateUtils.ts`.

## Impacto

| Cenario | Antes | Depois |
|---------|-------|--------|
| Usuario agenda 13:00 | Zoom marca 16:00 | Zoom marca 13:00 |
| Usuario agenda 09:00 | Zoom marca 12:00 | Zoom marca 09:00 |
| Qualquer timezone BR | +3h de diferenca | Horario correto |

## Resumo das Modificacoes

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/tasks/MeetingConfigDialog.tsx` | Trocar `toISOString()` por funcao que formata em horario local |
