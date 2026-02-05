

# Tornar o Campo "Ganho em" Editável

## Objetivo
Permitir que vendedores editem a data de fechamento ("Ganho em" / `won_at`) diretamente na janela de detalhes do negócio, usando um date picker integrado.

---

## Mudança Visual

| Antes | Depois |
|-------|--------|
| Data exibida como texto estático | Data clicável que abre um calendário para seleção |
| `03/02/26` (apenas visualização) | `03/02/26` com ícone de edição → ao clicar abre Popover com Calendar |

---

## Implementação Técnica

### Arquivo a Modificar
`src/components/sales/DealDetailSheet.tsx`

### Mudanças Necessárias

**1. Adicionar imports**
- Importar `Popover`, `PopoverContent`, `PopoverTrigger` de `@/components/ui/popover`
- Importar `Calendar` de `@/components/ui/calendar`
- Importar ícone `Pencil` do lucide-react (já está importado)

**2. Adicionar estado local**
```typescript
const [wonAtPopoverOpen, setWonAtPopoverOpen] = useState(false);
const [updatingWonAt, setUpdatingWonAt] = useState(false);
```

**3. Criar função para atualizar a data**
```typescript
const handleWonAtChange = async (newDate: Date | undefined) => {
  if (!deal || !newDate) return;
  
  setUpdatingWonAt(true);
  try {
    const { error } = await supabase
      .from("deals")
      .update({ won_at: newDate.toISOString() })
      .eq("id", deal.id);
    
    if (error) throw error;
    
    toast.success("Data de fechamento atualizada!");
    setWonAtPopoverOpen(false);
    onDealUpdated?.();
  } catch (error) {
    console.error("Error updating won_at:", error);
    toast.error("Erro ao atualizar data");
  } finally {
    setUpdatingWonAt(false);
  }
};
```

**4. Substituir renderização estática por Popover + Calendar**

Trocar este trecho (linhas 710-719):
```tsx
{deal.status === 'won' && deal.won_at ? (
  <>
    <div className="flex items-center gap-1.5 mb-1">
      <Trophy className="h-3.5 w-3.5 text-emerald-500" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ganho em</span>
    </div>
    <p className="text-lg font-bold text-emerald-500">
      {format(new Date(deal.won_at), "dd/MM/yy")}
    </p>
  </>
)}
```

Por:
```tsx
{deal.status === 'won' && deal.won_at ? (
  <>
    <div className="flex items-center gap-1.5 mb-1">
      <Trophy className="h-3.5 w-3.5 text-emerald-500" />
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ganho em</span>
    </div>
    <Popover open={wonAtPopoverOpen} onOpenChange={setWonAtPopoverOpen}>
      <PopoverTrigger asChild>
        <button 
          className="flex items-center gap-1.5 text-lg font-bold text-emerald-500 hover:underline cursor-pointer group"
          disabled={updatingWonAt}
        >
          {format(new Date(deal.won_at), "dd/MM/yy")}
          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={new Date(deal.won_at)}
          onSelect={handleWonAtChange}
          locale={ptBR}
          disabled={updatingWonAt}
        />
      </PopoverContent>
    </Popover>
  </>
)}
```

---

## Fluxo de Uso

1. Vendedor abre detalhes de um negócio **ganho**
2. Visualiza o card "GANHO EM" com a data atual
3. Ao passar o mouse, aparece um ícone de lápis
4. Clica na data → abre calendário
5. Seleciona nova data → sistema salva automaticamente
6. Toast de confirmação aparece
7. O componente atualiza via `onDealUpdated()`

---

## Validações

- Apenas negócios com status `won` mostram o campo editável
- A seleção de data dispara salvamento imediato (sem botão de confirmar)
- Indicador de loading enquanto salva
- Toast de erro se falhar

