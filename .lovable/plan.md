

## Filtro de categorias nos visuais (ocultar grupos especificos)

### Problema
O usuario quer poder escolher quais categorias exibir em visuais como "Leads por MQL", ocultando por exemplo "Nao informado" para ver apenas os dados relevantes.

### Abordagem
Reutilizar o padrao ja existente de `hiddenUsers` (usado no visual `call_commercial`) criando um campo generico `hiddenCategories` no `VisualConfig`. O fluxo sera:

1. Abrir os Ajustes do Visual (icone de engrenagem)
2. Ver a lista de categorias disponiveis (extraidas dos dados do visual)
3. Desmarcar as que nao deseja exibir
4. Salvar

### Mudancas tecnicas

**1. Tipo `VisualConfig` (`src/components/insights/visual-builder/types.ts`)**
- Adicionar campo opcional `hiddenCategories?: string[]` ao `VisualConfig`

**2. Ajustes Rapidos (`src/components/insights/visuals/VisualQuickSettings.tsx`)**
- Adicionar estado local `hiddenCategories`
- Buscar os dados do visual (usando `useVisualData`) para extrair a lista de categorias unicas
- Renderizar uma secao "Categorias Visiveis" com checkboxes (mesmo padrao visual de "Vendedores Visiveis" do `call_commercial`)
- Exibir esta secao para visuais que nao sejam scorecard nem call_commercial (que ja tem seu proprio filtro)
- Persistir `hiddenCategories` no config ao salvar

**3. Card do Visual (`src/components/insights/visuals/ConfigurableVisualCard.tsx`)**
- Filtrar `processedData` removendo itens cujo `name` esteja em `config.hiddenCategories` antes de passar para o `ConfigurableChart`

### O que nao muda
- Visuais de scorecard (nao tem categorias)
- Visuais de call_commercial (ja usam `hiddenUsers`)
- Nenhuma alteracao no banco de dados
- Nenhuma alteracao nas queries de dados

