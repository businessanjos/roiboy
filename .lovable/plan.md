

# Plano de Correção: Agenda do Mentor Não Exibe Eventos

## Diagnóstico

Identifiquei **2 falhas críticas** que impedem o funcionamento da Agenda do Mentor:

### Falha 1: Data Inválida na Query (CRÍTICO)

O hook `useMentorEvents.tsx` está gerando uma data inválida `2026-02-31` (31 de fevereiro não existe). Isso causa erro **400 Bad Request** em todas as requisições:

```
scheduled_at=lte.2026-02-31
Response: {"code":"22008","message":"date/time field value out of range: \"2026-02-31\""}
```

**Código problemático (linha 45):**
```typescript
.lte('scheduled_at', `${year}-${monthStr}-31`);  // ❌ Assume 31 dias para todos os meses
```

### Falha 2: Cache Não Invalidado

Após salvar um evento com mentor vinculado, a query `mentor-events` não é invalidada, então mesmo que a consulta funcionasse, o calendário não seria atualizado.

**Código problemático (EventEditDialog.tsx linhas 209-210):**
```typescript
queryClient.invalidateQueries({ queryKey: ["events-with-products"] });
queryClient.invalidateQueries({ queryKey: ["events"] });
// ❌ Falta: queryClient.invalidateQueries({ queryKey: ["mentor-events"] });
```

---

## Correções Necessárias

### 1. Corrigir Cálculo de Último Dia do Mês

**Arquivo:** `src/hooks/useMentorEvents.tsx`

Usar função JavaScript para obter o último dia correto do mês:

```typescript
// Antes
.lte('scheduled_at', `${year}-${monthStr}-31`)

// Depois
const lastDay = new Date(year, month + 1, 0).getDate(); // Ex: 28 para fev, 31 para jan
.lte('scheduled_at', `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`)
```

### 2. Invalidar Cache do Mentor ao Salvar Evento

**Arquivo:** `src/components/events/EventEditDialog.tsx`

Adicionar invalidação da query `mentor-events`:

```typescript
onSuccess: () => {
  toast({ title: "Evento atualizado com sucesso" });
  queryClient.invalidateQueries({ queryKey: ["events-with-products"] });
  queryClient.invalidateQueries({ queryKey: ["events"] });
  queryClient.invalidateQueries({ queryKey: ["mentor-events"] });  // ✅ ADICIONAR
  onOpenChange(false);
  onSuccess?.();
},
```

### 3. Mesmo Ajuste no Events.tsx (Dialog de Criação)

**Arquivo:** `src/pages/Events.tsx`

Adicionar invalidação no handler de sucesso da criação de eventos.

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useMentorEvents.tsx` | Corrigir cálculo do último dia do mês |
| `src/components/events/EventEditDialog.tsx` | Invalidar cache `mentor-events` |
| `src/pages/Events.tsx` | Invalidar cache `mentor-events` na criação |

---

## Resultado Esperado

Após as correções:
1. A query para eventos de fevereiro usará a data correta `2026-02-28`
2. Ao vincular mentor a um evento, o calendário da Agenda será atualizado automaticamente
3. O evento aparecerá no calendário, na aba Eventos e nos Lembretes

---

## Detalhes Técnicos

### Lógica do Último Dia do Mês

```typescript
// new Date(year, month + 1, 0) retorna o último dia do mês
// Exemplos:
new Date(2026, 2, 0).getDate() // → 28 (último dia de fevereiro)
new Date(2026, 1, 0).getDate() // → 31 (último dia de janeiro)
new Date(2024, 2, 0).getDate() // → 29 (ano bissexto)
```

### Query Correta Esperada

```
GET /events?mentor_user_id=eq.de43a643...&scheduled_at=gte.2026-02-01&scheduled_at=lte.2026-02-28
```

