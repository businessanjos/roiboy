
# Plano: Substituir "Previsão" por "Ganho em" para Negócios Ganhos

## Contexto

Na janela de detalhes do negócio (DealDetailSheet), o quarto card sempre mostra "PREVISÃO" com a data esperada de fechamento. Quando o negócio já foi marcado como ganho, essa informação não faz mais sentido — o usuário quer ver a data em que o negócio foi efetivamente fechado.

## Solução

Modificar o quarto card no grid de estatísticas para mostrar condicionalmente:
- **"Ganho em"** com a data `won_at` quando `deal.status === 'won'`
- **"Previsão"** com a data `expected_close_date` para negócios abertos/perdidos

## Mudança no Arquivo

**Arquivo:** `src/components/sales/DealDetailSheet.tsx`  
**Linhas:** 709-719

### Antes:
```tsx
<div className="rounded-lg border p-3 bg-muted/30">
  <div className="flex items-center gap-1.5 mb-1">
    <Calendar className="h-3.5 w-3.5 text-violet-500" />
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Previsão</span>
  </div>
  <p className="text-lg font-bold text-foreground">
    {deal.expected_close_date
      ? format(new Date(deal.expected_close_date), "dd/MM/yy")
      : "—"}
  </p>
</div>
```

### Depois:
```tsx
<div className="rounded-lg border p-3 bg-muted/30">
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
  ) : (
    <>
      <div className="flex items-center gap-1.5 mb-1">
        <Calendar className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Previsão</span>
      </div>
      <p className="text-lg font-bold text-foreground">
        {deal.expected_close_date
          ? format(new Date(deal.expected_close_date), "dd/MM/yy")
          : "—"}
      </p>
    </>
  )}
</div>
```

## Resultado Visual

**Negócio Aberto:**
```
┌─────────────┬─────────────┐
│ 💵 VALOR    │ 📈 PROBABILIDADE │
│ R$ 156.000  │ 0%               │
├─────────────┼──────────────────┤
│ ⏰ IDADE    │ 📅 PREVISÃO      │
│ 9 dias      │ —                │
└─────────────┴──────────────────┘
```

**Negócio Ganho:**
```
┌─────────────┬─────────────┐
│ 💵 VALOR    │ 📈 PROBABILIDADE │
│ R$ 156.000  │ 0%               │
├─────────────┼──────────────────┤
│ ⏰ IDADE    │ 🏆 GANHO EM      │  ← Verde/emerald
│ 9 dias      │ 31/01/25         │
└─────────────┴──────────────────┘
```

## Notas Técnicas

- O ícone `Trophy` já está importado no arquivo (linha 48)
- O campo `deal.won_at` já existe na interface `Deal` e é preenchido automaticamente ao marcar como ganho
- A função `format` do date-fns já está importada
