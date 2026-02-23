

## Criar visual "Qtde Leads MQL - Dia" com barras empilhadas verticais

### Problema atual

A funcao `fetchStackedLeadsData` no hook `useStackedVisualData.ts` so suporta agrupamento categorico (ex: por canal, status). Ela nao possui logica de agrupamento temporal (dia 1-31). Alem disso, o componente `StackedHorizontalBarChart` renderiza barras horizontais, mas o visual de referencia mostra barras verticais empilhadas.

### Alteracoes

#### 1. `src/hooks/useStackedVisualData.ts` -- funcao `fetchStackedLeadsData`

Adicionar suporte a dimensao temporal para leads. Quando `dimension.type === 'date'` e `dateGrouping === 'day'`:

- Agrupar os leads pelo dia do mes (01-31), somando os valores de dias iguais de meses diferentes
- Empilhar pelo campo definido em `stackBy` (neste caso, `canal`)
- Gerar 31 pontos fixos (01 a 31) mesmo que alguns nao tenham dados
- A logica sera similar a que ja existe em `fetchStackedDealsData`, mas adaptada para leads

Fluxo atualizado:

```text
1. Buscar leads (existente)
2. Aplicar filtro de campo personalizado (existente - filtra MQL)
3. Enriquecer dados se necessario (existente)
4. [NOVO] Se dimension.type === 'date':
     - Determinar dateGrouping (day/week/month/year)
     - Para 'day': gerar pontos 01-31, agrupar por dia do mes
     - Empilhar por stackByField (canal)
   Senao:
     - Agrupar categoricamente (logica existente)
5. Retornar dados e seriesKeys
```

#### 2. `src/components/insights/visuals/StackedHorizontalBarChart.tsx` -- Suporte a layout vertical

Adicionar uma prop `layout` (ou detectar automaticamente quando a dimensao e temporal) para renderizar barras verticais em vez de horizontais:

- Trocar `layout="vertical"` para layout padrao (vertical bars)
- Eixo X: categorias (dias 01-31)
- Eixo Y: valores numericos
- Manter empilhamento, cores, tooltip e rotulos

#### 3. Inserir o visual no dashboard

Inserir um registro na tabela `insights_visuals` com a configuracao:

- **Titulo**: "Qtde Leads MQL - Dia"
- **Tipo**: `bar_stacked`
- **Fonte**: `leads`
- **Dimensao**: `created_at` com `dateGrouping: 'day'` e `type: 'date'`
- **Empilhamento**: `canal`
- **Filtro MQL**: campo `e4270e93-e9b9-4d9b-9589-d614ce335bcd`, valor `"SIM - Acima de 30k"`
- **Aparencia**: rotulos de dados habilitados, paleta vibrante

### Secao tecnica

**Logica de agrupamento diario para leads** (nova em `fetchStackedLeadsData`):

```text
Para cada lead filtrado:
  1. Extrair dia do mes de created_at (ex: 15)
  2. Extrair valor do campo stackBy (ex: "Trafego Pago")
  3. Incrementar contagem em periodMap[dia][canal]

Resultado: 31 pontos, cada um com contagens por canal
Ex: { name: "01", "Trafego Pago": 11, "Social Seller": 3, "Comercial": 1 }
```

**Componente de barras verticais empilhadas**: O `StackedHorizontalBarChart` sera adaptado para aceitar uma prop `orientation` ('vertical' ou 'horizontal'). Quando vertical:
- `BarChart` sem `layout="vertical"`
- `XAxis` como category (dias), `YAxis` como number
- Rotulos no topo das barras em vez de dentro
- Altura fixa em vez de dinamica

**Config do visual a inserir**:
```text
{
  dataSource: 'leads',
  measure: { field: '', aggregation: 'count' },
  dimension: { field: 'created_at', type: 'date', dateGrouping: 'day' },
  stackBy: 'canal',
  formatting: { type: 'decimal', decimals: 0 },
  appearance: { showDataLabels: true, colorPalette: 'vibrant', fillEmptyDates: true },
  leadFieldFilter: {
    fieldId: 'e4270e93-e9b9-4d9b-9589-d614ce335bcd',
    fieldName: 'MQL',
    selectedValues: ['SIM - Acima de 30k']
  }
}
```

### Arquivos modificados

1. **`src/hooks/useStackedVisualData.ts`**: Adicionar logica temporal na funcao `fetchStackedLeadsData`
2. **`src/components/insights/visuals/StackedHorizontalBarChart.tsx`**: Adicionar suporte a layout vertical
3. **Banco de dados**: Inserir o visual no dashboard `e9fdb6c9-5ede-4c88-9c26-acb5870b18dd`
