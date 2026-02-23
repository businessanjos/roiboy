

## Corrigir crash do painel Comercial causado pelo Mapa de Bolhas

### Causa raiz

O erro `render2 is not a function` no `Context.Consumer` dentro do `MapContainerComponent` e um problema de incompatibilidade de versao: **react-leaflet v5 requer React 19**, mas o projeto usa **React 18**. A versao `^5.0.0` instalada nao e compativel.

### Solucao

#### 1. Downgrade do react-leaflet para v4

Alterar `package.json` para usar `react-leaflet` versao `^4.2.1`, que e a ultima versao compativel com React 18. A API dos componentes (`MapContainer`, `TileLayer`, `CircleMarker`, `Tooltip`) e identica entre v4 e v5, entao nenhuma mudanca de codigo e necessaria no componente.

#### 2. Adicionar Error Boundary no ConfigurableVisualCard

Como camada extra de protecao, envolver a renderizacao de cada visual em um error boundary para que, caso qualquer visual individual falhe, ele nao derrube o dashboard inteiro -- apenas mostra uma mensagem de erro no card daquele visual.

### Arquivos alterados

- **package.json**: `react-leaflet` de `^5.0.0` para `^4.2.1`
- **src/components/insights/visuals/ConfigurableVisualCard.tsx**: Adicionar um `ErrorBoundary` wrapper simples ao redor do conteudo do card

### Resultado

- O painel Comercial volta a funcionar normalmente
- O mapa de bolhas renderiza corretamente com React 18
- Futuros erros em visuais individuais nao derrubam o dashboard inteiro

