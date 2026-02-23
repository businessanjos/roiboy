

## Adicionar "Indicador" ao modal de criacao de visuais

### Problema

O tipo "Indicador" foi implementado no sistema de renderizacao (`ConfigurableChart`, `ConfigurableIndicator`, `types.ts`) mas **nao foi adicionado ao modal principal** usado para criar visuais (`AddVisualModal.tsx`). Esse modal tem sua propria lista de tipos (`CHART_TYPES`) que nao inclui o indicador.

### Alteracoes

#### `src/components/insights/AddVisualModal.tsx`

1. **Atualizar o tipo `ChartType` (linha 23):** Adicionar `"indicator"` ao union type local.

2. **Importar o icone `Activity` (linha 13):** Adicionar a importacao do icone do lucide-react.

3. **Adicionar ao array `CHART_TYPES` (apos linha 36):** Inserir a opcao:
   ```text
   { value: "indicator", label: "Indicador", description: "Arco semicircular com valor e escala personalizada", icon: Activity }
   ```

4. **Atualizar `totalSteps` (linha 142):** Incluir `'indicator'` no grupo de tipos com apenas 2 steps (nao precisa de metrica/groupBy tradicionais, pois tera inputs proprios de min/max).

5. **Adicionar estado para configuracao do indicador:** Criar estados `indicatorMin`, `indicatorMax`, `indicatorMinLabel`, `indicatorMaxLabel` e `indicatorMetric`.

6. **Adicionar Step 2 condicional para indicator:** Quando `chartType === 'indicator'`:
   - Selecao da metrica (reutilizando METRICS existente, excluindo "meta")
   - Inputs para "Valor Minimo" e "Valor Maximo"
   - Inputs opcionais para labels do min/max
   - Input do titulo

7. **Atualizar `canCreate` (linha 182-186):** Adicionar validacao para indicator: metrica selecionada, min/max preenchidos, max > min, titulo preenchido.

8. **Atualizar `handleCreate` (apos bloco do gauge):** Adicionar bloco para `chartType === 'indicator'`:
   - Montar `VisualConfig` usando a metrica selecionada (via `METRIC_TO_CONFIG`)
   - Incluir `indicatorConfig` com `minValue`, `maxValue`, `minLabel`, `maxLabel`
   - Dimensao definida como `{ field: '_total', type: 'text' }` (valor unico agregado)
   - Layout `{ x: 0, y: 0, w: 4, h: 4 }`

9. **Atualizar `useEffect` de auto-titulo (linha 159-176):** Adicionar caso para `chartType === 'indicator'` gerando titulo como "Indicador".

### Resultado

O usuario vera a opcao "Indicador" no grid de tipos do modal "Adicionar Visual", com icone de atividade. Ao seleciona-lo, o passo 2 mostrara os campos de metrica, valor minimo/maximo, labels opcionais e titulo -- permitindo criar o visual indicador diretamente pelo fluxo simplificado.
