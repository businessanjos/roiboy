

# Correção: Atualização Imediata da Data "Ganho em"

## Problema Identificado
Quando o usuário altera a data "Ganho em":
1. O banco de dados é atualizado corretamente ✅
2. O toast de sucesso aparece ✅
3. **Porém** a UI continua exibindo a data antiga porque está lendo de `deal.won_at` (prop do componente pai)
4. A data só atualiza ao fechar/reabrir o modal porque o componente pai refaz o fetch

## Solução
Criar um estado local `localWonAt` que:
1. É inicializado com `deal.won_at` quando o deal muda
2. É atualizado **imediatamente** quando o usuário salva a nova data
3. É usado para renderizar a data na UI

---

## Implementação Técnica

### Arquivo: `src/components/sales/DealDetailSheet.tsx`

**1. Adicionar estado local para won_at:**
```typescript
const [localWonAt, setLocalWonAt] = useState<string | null>(deal?.won_at || null);
```

**2. Sincronizar estado local com prop quando deal muda:**
```typescript
useEffect(() => {
  setLocalWonAt(deal?.won_at || null);
}, [deal?.won_at]);
```

**3. Atualizar estado local imediatamente ao salvar:**
No `onSelect` do Calendar, antes do toast de sucesso:
```typescript
setLocalWonAt(newDate.toISOString()); // Atualização imediata da UI
```

**4. Usar `localWonAt` em vez de `deal.won_at` para renderizar:**
- Condição de exibição: `deal.status === 'won' && localWonAt`
- Data selecionada no calendário: `new Date(localWonAt)`
- Data formatada no botão: `format(new Date(localWonAt), "dd/MM/yy")`

---

## Fluxo Corrigido

1. Usuário clica na data "05/02/26"
2. Seleciona nova data "04/02/26" no calendário
3. **Imediatamente**: `setLocalWonAt(newDate.toISOString())` → UI mostra "04/02/26"
4. Banco de dados é atualizado em background
5. Toast de sucesso aparece
6. `onDealUpdated?.()` faz o componente pai refazer fetch (para manter sincronia)

---

## Mudanças no Código

| Local | Antes | Depois |
|-------|-------|--------|
| Estado | — | `const [localWonAt, setLocalWonAt] = useState(deal?.won_at)` |
| useEffect | — | Sincroniza `localWonAt` quando `deal?.won_at` muda |
| Condição de exibição | `deal.won_at` | `localWonAt` |
| Calendário selected | `new Date(deal.won_at)` | `new Date(localWonAt)` |
| Botão display | `format(new Date(deal.won_at), ...)` | `format(new Date(localWonAt), ...)` |
| onSelect | — | Adiciona `setLocalWonAt(newDate.toISOString())` |

