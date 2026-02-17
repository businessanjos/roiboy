

## Tornar "Barras Empilhadas" flexivel e adicionar seletor de sazonalidade

### Contexto

O visual "Barras Empilhadas" hoje esta limitado: so oferece 2 passos (metrica + titulo), sempre empilha por vendedor e agrupa por dia. O objetivo e torna-lo tao flexivel quanto "Barras Horizontal" (3 passos completos) e adicionar um seletor de sazonalidade (Diario/Semanal/Mensal/Anual) para TODOS os visuais que usam agrupamento temporal.

### Mudancas

**1. `src/components/insights/AddVisualModal.tsx`**

- Remover `bar_stacked` da lista de excecoes de 2 passos (linha 141) — passa a ter 3 passos como bar, bar_horizontal, line, pie
- Atualizar descricao do chart type de "Barras horizontais empilhadas por vendedor (diario)" para "Barras horizontais empilhadas por categoria"
- Atualizar validacao `canCreate` para exigir `groupBy` (remover tratamento especial)
- Remover bloco especifico de `handleCreate` para `bar_stacked` (linhas 200-243) — usar o fluxo generico, apenas adicionando `stackBy: 'responsible_name'` quando groupBy e temporal, ou usando o campo de groupBy como stackBy
- Adicionar estado `dateGrouping` (default: `'month'`)
- No passo 3, quando o usuario selecionar "Por Mes" (agrupamento temporal), exibir um seletor de sazonalidade com 4 opcoes: Diario, Semanal, Mensal, Anual
- Usar o `dateGrouping` selecionado no config de TODOS os tipos de visual (nao so bar_stacked)
- Auto-titulo: gerar titulo dinamico incluindo a sazonalidade quando aplicavel

**2. `src/hooks/useStackedVisualData.ts`**

- Suportar `dateGrouping` dinamico (day/week/month/year) lido de `config.dimension.dateGrouping` em vez de fixo em 'day'
- Suportar `stackBy` dinamico lido de `config.stackBy` (hoje ja le, mas a logica interna so funciona com seller)
- Adaptar a geracao de labels para cada tipo de agrupamento temporal (ex: "Jan", "Sem 1", "2026")
- Quando groupBy for categorico (ex: por produto, por etapa) e stackBy existir, agrupar pelo campo categorico no eixo Y e empilhar pelo stackBy

**3. `src/components/insights/visuals/StackedHorizontalBarChart.tsx`**

- Ajustes menores de label no tooltip (remover "Dia" hardcoded, usar label dinamico)

**4. `src/components/insights/visuals/ConfigurableVisualCard.tsx`**

- Ajustar a condicao `isStacked` para funcionar com o novo modelo (manter logica existente: `chartType === 'bar_stacked' && !!config?.stackBy`)

### Fluxo do usuario apos a mudanca

```text
Passo 1: Escolher formato → "Barras Empilhadas"
Passo 2: O que medir? → (mesmas opcoes de sempre: Faturamento, Negocios, etc.)
Passo 3: Como agrupar? → "Por Mes" / "Por Vendedor" / "Por Produto" / etc.
         Se temporal → Seletor de sazonalidade: Diario | Semanal | Mensal | Anual
         + Titulo do visual
```

### Logica de empilhamento

| GroupBy | Eixo (Y) | Empilhamento (stackBy) |
|---------|----------|----------------------|
| Temporal (Mes) | Periodos (dias/semanas/meses/anos) | Por vendedor (responsible_name) |
| Vendedor | Vendedores | Sem empilhamento (1 barra por vendedor) |
| Produto | Produtos | Por vendedor |
| Etapa | Etapas | Por vendedor |

### Seletor de sazonalidade (para TODOS os visuais)

O seletor aparecera no passo 3 sempre que o usuario escolher agrupamento temporal ("Por Mes"). Sera um grupo de botoes compactos:

- Diario
- Semanal
- Mensal (padrao)
- Anual

Isso afeta bar, bar_horizontal, bar_stacked, line e pie — qualquer visual com dimensao temporal.

### Secao tecnica

**Arquivos modificados:**

| Arquivo | Tipo de mudanca |
|---------|----------------|
| `AddVisualModal.tsx` | Estado dateGrouping, seletor de sazonalidade no passo 3, remover fluxo especial de bar_stacked |
| `useStackedVisualData.ts` | Suportar dateGrouping dinamico e stackBy generico |
| `StackedHorizontalBarChart.tsx` | Label dinamico no tooltip |
| `ConfigurableVisualCard.tsx` | Nenhuma ou minima |
| `visual-builder/types.ts` | Nenhuma (DateGrouping ja existe com day/week/month/year) |

