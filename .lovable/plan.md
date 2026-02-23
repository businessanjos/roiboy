

## Criar visual "Qtde Leads MQL - Mes" com barras empilhadas verticais

### Resumo

Inserir um novo visual no dashboard seguindo a mesma logica dos visuais "Qtde Leads MQL - Dia" e "Qtde Leads MQL - Semana", mas com sazonalidade mensal. Conforme a imagem de referencia, o grafico usa barras verticais empilhadas com labels de mes abreviado (jan, fev, mar...).

### Alteracoes

#### 1. Inserir visual no banco de dados

Nenhuma alteracao de codigo e necessaria -- a logica de agrupamento mensal ja existe em `fetchStackedLeadsData` e o formato de label (`MMM/yy`) ja esta implementado. Basta inserir o registro na tabela `insights_visuals` com:

- **Titulo**: "Qtde Leads MQL - Mes"
- **Tipo**: `bar_stacked`
- **Config**:
  - `dataSource: 'leads'`
  - `dimension: { field: 'created_at', type: 'date', dateGrouping: 'month' }`
  - `stackBy: 'canal'`
  - `chartOrientation: 'vertical'` (barras verticais como na imagem)
  - Mesmo filtro MQL dos outros visuais
  - Mesma aparencia (rotulos, paleta vibrante)
- **Dashboard**: `e9fdb6c9-5ede-4c88-9c26-acb5870b18dd`

### Secao tecnica

Nenhum arquivo precisa ser modificado. Toda a logica ja esta implementada:
- Agrupamento mensal em `fetchStackedLeadsData` gera labels como `jan/25`, `fev/25`
- Orientacao vertical via `chartOrientation: 'vertical'`
- Filtro MQL e empilhamento por canal reutilizados

Apenas uma insercao no banco de dados e necessaria.

