
# Plano: Exibir Data de Ganho em Todas as Telas de Detalhes do Negócio

## Resumo

A data de fechamento (`won_at`) será exibida em todos os locais onde informações do negócio são mostradas, mas apenas quando o negócio foi marcado como ganho (`status === 'won'`).

## Locais de Implementação

### 1. DealDetailSheet (Janela de Detalhes Principal)

**Arquivo:** `src/components/sales/DealDetailSheet.tsx`

Adicionar um card no grid de estatísticas quando o negócio for ganho:

**Localização:** Na seção de stats cards (linha ~687), substituir ou adicionar condicionalmente o card de "Previsão" por "Fechado em" quando for negócio ganho.

```text
Antes (para negócios ganhos):
┌─────────────┬─────────────┐
│ Valor       │ Probabilidade│
├─────────────┼─────────────┤
│ Idade       │ Previsão     │
└─────────────┴─────────────┘

Depois (para negócios ganhos):
┌─────────────┬─────────────┐
│ Valor       │ Probabilidade│
├─────────────┼─────────────┤
│ Idade       │ Fechado em   │  ← Mostra won_at em vez de Previsão
└─────────────┴─────────────┘
```

A implementação será:
- Se `deal.status === 'won' && deal.won_at`: mostrar card "Fechado em" com ícone Trophy
- Caso contrário: mostrar card "Previsão" existente

### 2. ZappDealDetailSheet (Detalhes no RoyZapp)

**Arquivo:** `src/components/royzapp/ZappDealDetailSheet.tsx`

Mesma lógica aplicada ao grid de estatísticas (linha ~486):
- Substituir card "Previsão" por "Fechado em" quando negócio for ganho
- O componente já usa `SELECT *` então já tem acesso ao `won_at`

### 3. DealDialog (Dialog de Edição)

**Arquivo:** `src/components/sales/DealDialog.tsx`

Adicionar informação da data de ganho no header do dialog quando for negócio ganho:

```text
Antes:
┌──────────────────────────────────────┐
│ Editar Negociação  [Badge: Ganha]    │
│ Atualize os detalhes da negociação   │
└──────────────────────────────────────┘

Depois:
┌──────────────────────────────────────┐
│ Editar Negociação  [Badge: Ganha]    │
│ Fechado em 15/01/2025               │  ← Novo
└──────────────────────────────────────┘
```

## Detalhes Técnicos

### Código para DealDetailSheet (linha ~709-719)

Substituir o card de Previsão por lógica condicional:

```tsx
{/* Fourth card - Previsão OU Fechado em */}
<div className="rounded-lg border p-3 bg-muted/30">
  {deal.status === 'won' && deal.won_at ? (
    // Card para negócios ganhos
    <>
      <div className="flex items-center gap-1.5 mb-1">
        <Trophy className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Fechado em</span>
      </div>
      <p className="text-lg font-bold text-emerald-500">
        {format(new Date(deal.won_at), "dd/MM/yy")}
      </p>
    </>
  ) : (
    // Card de previsão para negócios abertos/perdidos
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

### Código para ZappDealDetailSheet (linha ~486-497)

Mesma lógica condicional no card de Previsão:

```tsx
<Card className="p-3 bg-zapp-panel border-zapp-border">
  {deal.status === 'won' && (deal as any).won_at ? (
    <>
      <div className="flex items-center gap-2 text-zapp-text-muted mb-1">
        <Trophy className="h-3.5 w-3.5" />
        <span className="text-xs">Fechado em</span>
      </div>
      <p className="text-sm font-medium text-green-500">
        {format(new Date((deal as any).won_at), "dd/MM/yy")}
      </p>
    </>
  ) : (
    <>
      <div className="flex items-center gap-2 text-zapp-text-muted mb-1">
        <Calendar className="h-3.5 w-3.5" />
        <span className="text-xs">Previsão</span>
      </div>
      <p className="text-sm font-medium text-zapp-text">
        {deal.expected_close_date 
          ? format(new Date(deal.expected_close_date), "dd/MM/yy")
          : "-"
        }
      </p>
    </>
  )}
</Card>
```

Também precisamos atualizar a interface `Deal` para incluir o campo `won_at`:

```tsx
interface Deal {
  // ... campos existentes
  won_at?: string | null;  // Adicionar
}
```

### Código para DealDialog (linha ~373-378)

Adicionar data de fechamento na descrição:

```tsx
<DialogDescription>
  {isEditing 
    ? (deal?.status === 'won' && deal?.won_at
        ? `Fechado em ${format(new Date(deal.won_at), "dd/MM/yyyy", { locale: ptBR })}`
        : "Atualize os detalhes da negociação")
    : "Adicione uma nova oportunidade ao pipeline"
  }
</DialogDescription>
```

## Arquivos a Modificar

1. **`src/components/sales/DealDetailSheet.tsx`**
   - Importar ícone `Trophy` (já importado)
   - Adicionar lógica condicional no card de estatísticas

2. **`src/components/royzapp/ZappDealDetailSheet.tsx`**
   - Importar ícone `Trophy`
   - Atualizar interface `Deal` para incluir `won_at`
   - Adicionar lógica condicional no card de estatísticas

3. **`src/components/sales/DealDialog.tsx`**
   - Adicionar data de fechamento no `DialogDescription` para negócios ganhos

## Resultado Visual

**DealDetailSheet para negócio ganho:**
```
┌─────────────┬─────────────┐
│   💵        │    📈       │
│ R$ 70.800   │    50%      │
│   Valor     │ Probabilidade│
├─────────────┼─────────────┤
│   ⏰        │    🏆       │
│  45 dias    │  15/01/25   │
│   Idade     │ Fechado em  │  ← Verde/emerald
└─────────────┴─────────────┘
```

## Impacto

- **Visibilidade**: Data de fechamento sempre visível para negócios ganhos
- **Contexto**: Substitui "Previsão" que não faz sentido para negócios já fechados
- **Consistência**: Mesmo padrão visual em todas as telas de detalhes
