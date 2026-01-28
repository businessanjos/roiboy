
# Plano: Corrigir Exibição Completa da Timeline de Clientes

## Problema Identificado

A timeline de clientes está limitando artificialmente os dados exibidos através de múltiplos limites nas queries do `ClientDetail.tsx`:

### Limites Atuais
| Query | Limite Atual | Dados Existentes |
|-------|--------------|------------------|
| `client_followups` (notas/anexos) | `.limit(30)` | Até 20 por cliente |
| `message_events` | `.limit(20)` | Até 20.635 por cliente |
| `risk_events` | `.limit(20)` | 160 total |
| `life_events` | `.limit(20)` | - |
| `form_responses` | `.limit(20)` | - |
| `event_participants` | `.limit(20)` | - |
| `client_subscriptions` | `.limit(20)` | - |
| **Corte Final** | `slice(0, 50)` | **Este é o maior problema** |

### Por que Parece "Só 7 dias"
Clientes ativos recebem muitas mensagens diariamente. Com o limite de 50 itens totais na timeline e mensagens dominando a lista, as notas e anexos mais antigos são empurrados para fora do corte.

---

## Solução Proposta

### Fase 1: Remover Limites Desnecessários (Correção Imediata)

**Arquivo:** `src/pages/ClientDetail.tsx`

1. **Remover limite de `client_followups`** (linha 849):
   - De: `.limit(30)`
   - Para: Sem limite (são poucos registros por cliente - máximo ~20)

2. **Aumentar limite de `message_events`** (linha 770):
   - De: `.limit(20)`
   - Para: `.limit(100)` ou remover (para conversas completas)

3. **Aumentar limite de outros eventos** (linhas 815, 880, 906, 933, 955):
   - De: `.limit(20)`
   - Para: `.limit(100)`

4. **Aumentar ou remover corte final** (linha 974):
   - De: `timelineItems.slice(0, 50)`
   - Para: `timelineItems.slice(0, 200)` ou remover completamente

### Fase 2: FinancialNotes (Verificação)

**Arquivo:** `src/components/client/FinancialNotes.tsx`

A query atual (linha 66-75) já não tem limite, então está correta:
```typescript
.eq("client_id", clientId)
.in("type", ["financial_note", "image", "file"])
.is("parent_id", null)
.order("created_at", { ascending: false });
// Sem .limit() - OK!
```

---

## Modificações Detalhadas

### `src/pages/ClientDetail.tsx`

| Linha | Atual | Novo |
|-------|-------|------|
| 770 | `.limit(20)` | `.limit(200)` |
| 815 | `.limit(20)` | `.limit(100)` |
| 849 | `.limit(30)` | **Remover** |
| 880 | `.limit(20)` | `.limit(100)` |
| 906 | `.limit(20)` | `.limit(100)` |
| 933 | `.limit(20)` | `.limit(100)` |
| 955 | `.limit(20)` | `.limit(100)` |
| 974 | `slice(0, 50)` | `slice(0, 300)` |

---

## Considerações de Performance

### Por que esses aumentos são seguros:

1. **`client_followups`**: Máximo de 20 registros por cliente atualmente - remover limite não afeta performance

2. **`message_events`**: Cliente mais ativo tem ~20.000 mensagens, mas a timeline é ordenada por data e só precisa mostrar os mais recentes. Limite de 200 é suficiente para contexto histórico

3. **Corte final de 300**: Ainda mantém um limite razoável para renderização, mas permite visualizar dados de ~30 dias ou mais

4. **Paginação futura**: Se necessário, podemos implementar "Carregar mais" posteriormente, mas para a maioria dos casos 300 itens é suficiente

---

## Resultado Esperado

1. **Todas as notas e anexos** do cliente aparecerão na timeline (sem limite de 7 dias)
2. **Histórico mais completo** de mensagens, eventos e interações
3. **Performance mantida** com limites razoáveis aumentados
4. **FinancialNotes** continuará funcionando corretamente (já não tem limite)

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/ClientDetail.tsx` | Remover/aumentar limites nas queries e no slice final |
