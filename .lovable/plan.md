

## Criar Visual de Mapa de Bolhas no Painel Comercial

### Resumo

Criar um novo tipo de visual "Mapa de Bolhas" que exibe a distribuicao geografica dos negocios ganhos no mapa, com bolhas proporcionais ao faturamento de cada cidade. O visual inclui um mapa interativo a esquerda e uma tabela com as Top 10 regioes a direita.

### Dados disponíveis

O campo personalizado "Cidade" (ID: `5accffbd-3d87-4735-b890-bc6c361694b7`) e do tipo `location` e armazena no `value_json`:
- `formatted_address`: "Arapongas, Parana, Brasil"
- `latitude`: -23.41
- `longitude`: -51.42

Existem 62 negocios ganhos com dados de cidade cadastrados.

### Arquitetura

O visual sera composto por:

1. **Novo tipo de chart**: `bubble_map`
2. **Biblioteca de mapas**: `react-leaflet` + `leaflet` (gratuito, usa tiles do OpenStreetMap, sem necessidade de API key)
3. **Hook de dados dedicado**: Busca negocios ganhos com campo Cidade preenchido, agrupa por cidade, soma valores
4. **Componente do visual**: Mapa com bolhas + tabela Top 10 lado a lado

### Alteracoes

#### 1. Dependencias

Instalar `react-leaflet` e `leaflet` (+ `@types/leaflet`).

#### 2. `src/components/insights/visual-builder/types.ts`

- Adicionar `'bubble_map'` ao tipo `ChartType`
- Adicionar entrada em `CHART_TYPE_OPTIONS`

#### 3. `src/hooks/useMapVisualData.ts` (novo)

Hook dedicado que:
- Busca `deal_field_values` onde `field_id = '5accffbd-...'` com `value_json` nao nulo
- Faz JOIN com `deals` onde `status = 'won'`
- Respeita os filtros globais do Insights (data, vendedor, produto)
- Agrupa por `formatted_address`, somando `deal.value`
- Retorna array de `{ city: string, lat: number, lng: number, revenue: number, dealCount: number }`

#### 4. `src/components/insights/visuals/ConfigurableBubbleMap.tsx` (novo)

Componente principal com layout lado a lado:
- **Esquerda (~60%)**: Mapa Leaflet com tiles OSM, centralizado no Brasil, com circulos (bolhas) em cada cidade. O raio da bolha e proporcional ao faturamento (escala relativa ao valor maximo).
- **Direita (~40%)**: Tabela com as Top 10 cidades por faturamento, ordenadas do maior para o menor, com linha de total no rodape. Formatacao em R$ (moeda).

#### 5. `src/components/insights/visuals/ConfigurableChart.tsx`

Adicionar case `'bubble_map'` no switch que renderiza o componente `ConfigurableBubbleMap`.

#### 6. `src/components/insights/visuals/ConfigurableVisualCard.tsx`

Ajustar a logica para que o tipo `bubble_map` use o hook `useMapVisualData` em vez do `useVisualData` padrao, similar a como `gauge` e `bar_stacked` ja tem tratamento especial.

#### 7. `src/components/insights/AddVisualModal.tsx`

Adicionar a opcao "Mapa de Bolhas" na lista de tipos de chart (Step 1), com icone `MapPin`. O fluxo sera simplificado (2 passos apenas: escolher tipo + definir titulo), pois a fonte de dados e fixa (negocios ganhos agrupados por cidade).

#### 8. CSS do Leaflet

Importar o CSS do Leaflet (`leaflet/dist/leaflet.css`) no componente ou globalmente para garantir a renderizacao correta do mapa.

### Detalhes tecnicos

```text
+-----------------------------------------------+
|  Mapa de Faturamento por Cidade                |
+-----------------------------------------------+
|                        |  TOP 10    Faturamento |
|    [Mapa Leaflet]      |  Cidade A   R$ 622.800 |
|    com bolhas          |  Cidade B   R$ 526.000 |
|    proporcionais       |  Cidade C   R$ 444.000 |
|    ao faturamento      |  ...                    |
|                        |  Total     R$ 4.003.600 |
+-----------------------------------------------+
```

- Bolhas usam `CircleMarker` do Leaflet com raio calculado: `minRadius + (value / maxValue) * (maxRadius - minRadius)`
- Cor das bolhas: azul primario com opacidade
- Tooltip ao passar o mouse na bolha: nome da cidade + valor formatado
- Mapa centralizado em [-14.2, -51.9] (centro do Brasil) com zoom 4

### Criacao automatica do visual

Apos implementar, sera inserido um registro no banco no dashboard "Comercial" (ID: `e85ae05b-a445-496f-ac14-e9ce63117403`) com `chart_type: 'bubble_map'` e layout adequado (largura total do grid).

