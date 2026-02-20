

## Corrigir visual "Barras Empilhadas" no painel compartilhado

### Problema

O visual "Faturamento Diario por Vendedor" usa o tipo `bar_stacked`, que requer uma estrutura de dados diferente dos demais visuais. Enquanto visuais normais usam `AggregatedDataPoint[]` (pares nome/valor), o grafico de barras empilhadas precisa de `StackedDataPoint[]` (um objeto por periodo com propriedades dinamicas por vendedor) e um array `seriesKeys` (nomes dos vendedores).

Atualmente:
- A funcao backend que computa os dados (`shared-dashboard`) so sabe gerar `AggregatedDataPoint[]` simples
- O componente `SharedVisualCard` nunca passa `stackedData` nem `stackedSeriesKeys` ao `ConfigurableChart`
- O `ConfigurableChart` recebe arrays vazios para esses props e mostra "Sem dados para exibir"

### Solucao (3 arquivos)

#### 1. Edge Function `supabase/functions/shared-dashboard/index.ts`

Adicionar uma nova funcao `computeStackedVisualData` que:
- Busca negocios da tabela `deals` com join em `users` (vendedor)
- Agrupa por periodo temporal (dia/semana/mes/ano) E por vendedor
- Gera todos os periodos no intervalo (01-31 para diario)
- Retorna `{ data: StackedDataPoint[], seriesKeys: string[] }`

No handler GET, para visuais do tipo `bar_stacked`:
- Chamar `computeStackedVisualData` em vez de `computeVisualData`
- Armazenar o resultado em um campo separado `stackedVisualsData` no JSON de resposta

#### 2. Frontend `src/pages/SharedInsightsDashboard.tsx`

- Adicionar estado `stackedVisualsData` para armazenar dados empilhados por visual ID
- Ao receber a resposta da API, extrair `stackedVisualsData` e salvar no estado
- Passar os dados empilhados como props para `SharedVisualCard`

#### 3. Componente `src/components/insights/visuals/SharedVisualCard.tsx`

- Aceitar props opcionais `stackedData` e `stackedSeriesKeys`
- Passar esses props para o `ConfigurableChart`
- Ajustar a verificacao de "sem dados" para tambem considerar `stackedData`

### Detalhes tecnicos

A logica de agregacao empilhada no edge function replica a do hook `useStackedVisualData`:
- Para agrupamento "day": intervalo fixo 01-31, agregando dias correspondentes
- Para "month"/"week"/"year": gera todos os periodos no intervalo
- Campo de data inteligente: usa `won_at` para status "won", `lost_at` para "lost", `created_at` para os demais
- Agrupa por vendedor (`users.name`) via join

Estrutura de dados gerada:
```text
data: [
  { name: "01", "Darlan Ferreira": 142000, "Jonathan Marcato": 0, ... },
  { name: "02", "Darlan Ferreira": 0, "Jonathan Marcato": 156000, ... },
  ...
]
seriesKeys: ["Darlan Ferreira", "Everton Pieri", "Jonathan Marcato", "Vanessa Minelli"]
```
