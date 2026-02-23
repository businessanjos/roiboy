
## Corrigir o visual "Mapa de Faturamento por Cidade" que nao renderiza

### Causa raiz

O erro `render2 is not a function` persiste mesmo apos o downgrade do `react-leaflet` para v4.2.1. O problema esta no cache de dependencias do Vite (`node_modules/.vite/deps/`) que continua servindo o bundle antigo da v5, e/ou na incompatibilidade persistente da biblioteca `react-leaflet` com o ambiente atual.

### Solucao: Substituir react-leaflet por Leaflet puro

A abordagem mais robusta e **eliminar completamente a dependencia do `react-leaflet`** e usar a API imperativa do `leaflet` diretamente com `useRef` e `useEffect`. Isso contorna qualquer problema de compatibilidade com versoes do React, ja que o `leaflet` puro nao depende de nenhuma versao especifica do React.

### Alteracoes

#### 1. `src/components/insights/visuals/ConfigurableBubbleMap.tsx`

Reescrever o componente para usar Leaflet puro:

- Remover todos os imports de `react-leaflet` (`MapContainer`, `TileLayer`, `CircleMarker`, `Tooltip`)
- Importar `L` (Leaflet) diretamente: `import L from "leaflet"`
- Usar `useRef` para a div container do mapa
- Usar `useEffect` para inicializar o mapa imperativa:
  - Criar `L.map()` com centro no Brasil `[-14.2, -51.9]` e zoom 4
  - Adicionar `L.tileLayer()` com tiles do OpenStreetMap
  - Para cada ponto de dados, criar `L.circleMarker()` com raio proporcional ao faturamento
  - Adicionar `bindTooltip()` para mostrar nome da cidade e valor formatado
- Retornar cleanup function no `useEffect` para destruir o mapa ao desmontar
- Manter toda a logica da tabela Top 10 inalterada

#### 2. `package.json`

Remover `react-leaflet` das dependencias, mantendo apenas `leaflet` e `@types/leaflet`.

### Resultado

- O mapa renderiza corretamente sem depender de wrappers React
- Zero risco de incompatibilidade de versao do React
- Funcionalidade identica: bolhas proporcionais, tooltips, tabela Top 10
- A biblioteca `leaflet` pura e estavel e nao tem requisitos de versao do React
