

## Ranking de Vendedores por Faturamento

Construir um novo tipo de visual "Ranking" no sistema de Insights que exibe uma tabela estilizada com os vendedores ordenados por faturamento, inspirado no layout do Power BI compartilhado.

### O que sera construido

Um novo tipo de grafico **"ranking"** disponivel no modal de criacao de visuais, que renderiza uma tabela com:

- **Posicao** (1o, 2o, 3o com destaque visual dourado/prata/bronze)
- **Avatar** do vendedor (foto ou iniciais)
- **Nome** do vendedor
- **Faturamento** com barra de progresso visual
- **Meta** (valor configuravel por vendedor, se disponivel)
- **% Atingido** e **% Faltante** (calculados automaticamente quando meta existir)

A versao inicial funcionara com os dados ja disponiveis (deals ganhos por vendedor), sem necessidade de tabela de metas (que pode ser adicionada futuramente).

### Arquivos a criar

1. **`src/components/insights/visuals/ConfigurableRanking.tsx`**
   - Componente de tabela estilizada com ranking
   - Medalhas visuais para top 3 (ouro, prata, bronze)
   - Avatars dos vendedores (buscados da tabela `users`)
   - Barra de progresso proporcional ao maior valor
   - Formatacao de moeda em R$

### Arquivos a modificar

2. **`src/components/insights/visual-builder/types.ts`**
   - Adicionar `'ranking'` ao tipo `ChartType`
   - Adicionar opcao no array `CHART_TYPE_OPTIONS`

3. **`src/components/insights/AddVisualModal.tsx`**
   - Adicionar "Ranking" como opcao de formato (passo 1)
   - Para ranking, pre-selecionar metrica "revenue" e agrupamento "user"
   - Ranking tera apenas 2 passos (formato + titulo), pois metrica e agrupamento sao fixos

4. **`src/components/insights/visuals/ConfigurableChart.tsx`**
   - Adicionar case `'ranking'` no switch para renderizar o `ConfigurableRanking`

5. **`src/hooks/useVisualData.ts`**
   - Enriquecer os dados quando agrupados por vendedor para incluir `avatar_url` e `user_id` nos pontos retornados

### Detalhes tecnicos

**Dados**: O ranking reutiliza a infraestrutura existente do `useVisualData` com `statusFilter: 'won'`, `dimension.field: 'responsible_name'`, `measure.aggregation: 'sum'`, `measure.field: 'value'`. Os dados ja retornam agrupados por vendedor com o valor total.

**Avatars**: Para exibir as fotos, o `fetchDealsData` sera modificado para, quando o agrupamento for `responsible_name`, incluir o `avatar_url` do usuario nos dados retornados (campo extra no `AggregatedDataPoint`).

**Barra de progresso**: Calculada proporcionalmente ao maior valor do ranking (o primeiro lugar = 100%).

**Layout padrao**: O ranking sera criado com `w: 6, h: 5` no grid para acomodar a tabela.

**Visual**: 
```text
+----+--------+-----------------+-------------+
| #  | Foto   | Vendedor        | Faturamento |
+----+--------+-----------------+-------------+
| 1  | [img]  | Jonathan M.     | R$ 382.800  |
|    |        |  ████████████░  |             |
+----+--------+-----------------+-------------+
| 2  | [img]  | Darlan F.       | R$ 283.200  |
|    |        |  █████████░░░░  |             |
+----+--------+-----------------+-------------+
| 3  | [img]  | Everton P.      | R$ 0        |
|    |        |  ░░░░░░░░░░░░░  |             |
+----+--------+-----------------+-------------+
```

Medalhas: posicao 1 = dourado, 2 = prateado, 3 = bronze, demais = numeral simples.

### Observacoes

- A funcionalidade de **Meta** (valor alvo por vendedor) nao sera implementada nesta versao, pois requer uma tabela de metas no banco. Pode ser adicionada como evolucao futura.
- O ranking respeita os filtros globais do painel de Insights (periodo, vendedor, etapa).
- A ordenacao e sempre decrescente por valor (maior faturamento primeiro).
