
# Plano: Corrigir Bug de Timezone nos Momentos CX

## Problema Identificado

O usuário seleciona a data `01/02/1987` no formulário, mas ao salvar e exibir, aparece `31/01/1987` (um dia antes).

### Causa Raiz

O JavaScript interpreta `new Date("YYYY-MM-DD")` como **UTC meia-noite**. Em fusos horários negativos (como Brasil UTC-3), a conversão para hora local resulta no dia anterior:

```text
Usuário seleciona: 01/02/1987
Salvo no banco:    "1987-02-01" (correto)
new Date() cria:   1987-02-01 00:00:00 UTC
Convertido local:  1987-01-31 21:00:00 (Brasil UTC-3)
Exibido:           31/01/1987 (ERRADO)
```

### Locais Afetados no Código

| Linha | Código Problemático | Uso |
|-------|---------------------|-----|
| 452 | `new Date(event.event_date)` | Cálculo de próxima ocorrência |
| 456 | `new Date(eventDate)` | Cálculo de próxima ocorrência |
| 598 | `format(new Date(event.event_date), ...)` | Formatação na lista |

---

## Solução

O projeto já possui funções utilitárias em `src/lib/dateUtils.ts` criadas para evitar esse problema:

```typescript
// Parseia "1987-02-01" como 01/02/1987 00:00 LOCAL (não UTC)
parseLocalDate("1987-02-01") 
// Resultado: Date(1987, 1, 1) = 01/02/1987 meia-noite local

// Formata diretamente sem passar por Date
formatLocalDate("1987-02-01")
// Resultado: "01/02/1987"
```

---

## Modificações

### Arquivo: `src/components/client/ClientLifeEvents.tsx`

**1. Adicionar import:**
```typescript
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
```

**2. Corrigir função `getNextOccurrence` (linhas 449-464):**

Antes:
```typescript
const eventDate = new Date(event.event_date);  // ← UTC
```

Depois:
```typescript
const eventDate = parseLocalDate(event.event_date);  // ← Local
if (!eventDate) return null;
```

**3. Corrigir formatação da data na lista (linha 598):**

Antes:
```typescript
{format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
```

Depois:
```typescript
{formatLocalDate(event.event_date)}
```

---

## Fluxo Após Correção

```text
Usuário seleciona: 01/02/1987
Salvo no banco:    "1987-02-01"
parseLocalDate():  new Date(1987, 1, 1) = 01/02/1987 meia-noite LOCAL
formatLocalDate(): "01/02/1987" 
Exibido:           01/02/1987 (CORRETO)
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/client/ClientLifeEvents.tsx` | Importar e usar `parseLocalDate`/`formatLocalDate` |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Inserir data 01/02/1987 | Exibe 31/01/1987 | Exibe 01/02/1987 |
| Editar momento existente | Data errada no form | Data correta |
| Calcular "em X dias" | Pode errar 1 dia | Correto |
| Usuários em qualquer fuso | Inconsistente | Consistente |
