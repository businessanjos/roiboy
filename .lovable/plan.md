

# Plano: Grid de Visuais com Posicionamento Totalmente Livre (Estilo PowerBI)

## Problema Atual

O grid atual ainda apresenta comportamentos indesejados:
- **Áreas sombreadas (placeholders)** aparecem durante o arrasto, indicando onde o item vai "encaixar"
- **Compactação automática** reorganiza os itens mesmo com `noCompactor`
- **Colisão** faz com que itens empurrem outros durante o arrasto
- **Espaçamentos predefinidos** limitam o posicionamento preciso

## Solução: Posicionamento Livre Absoluto

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/insights/grid/InsightsGrid.tsx` | Usar compactor com `allowOverlap: false` + `preventCollision: true` + ocultar placeholder + remover transições |

### Configuração do Compactor

O `react-grid-layout` v2 oferece a função `getCompactor` que permite criar um compactor personalizado:

```typescript
import { getCompactor, noCompactor } from "react-grid-layout/core";

// Opção 1: noCompactor com preventCollision
// - Items ficam onde posicionados
// - Não podem ser colocados sobre outros (bloqueado)
// - Não empurram outros items

// Opção 2: getCompactor com allowOverlap
// - Permite sobreposição total
// - Posicionamento 100% livre
```

### Mudanças Específicas

1. **Remover o Placeholder Visual**
   - O placeholder é a área sombreada que aparece durante o arrasto
   - Ocultar via CSS: `display: none`

2. **Usar Compactor com `preventCollision: true`**
   - Quando `preventCollision: true` e `allowOverlap: false`:
     - Itens NÃO podem ser colocados sobre outros (snap back)
     - Itens NÃO empurram outros
   - Quando `allowOverlap: true`:
     - Posicionamento 100% livre, mesmo sobre outros items

3. **Remover Transições Durante Arrasto**
   - Transições causam a sensação de "encaixe"
   - Remover para movimento fluido

4. **Reduzir Margens para Zero**
   - Margens criam espaçamentos forçados
   - Usar `[0, 0]` para layout contíguo

### Código Proposto

```typescript
import GridLayout from "react-grid-layout";
import { getCompactor } from "react-grid-layout/core";

// Compactor livre: sem compactação, com prevenção de colisão
const freePositionCompactor = getCompactor(null, false, true);
// getCompactor(type, allowOverlap, preventCollision)
// - type: null = sem compactação vertical/horizontal
// - allowOverlap: false = não permite sobreposição
// - preventCollision: true = bloqueia movimento que causaria colisão

// OU para liberdade total (permite sobreposição):
const totalFreeCompactor = getCompactor(null, true, false);
```

### Estilo CSS Atualizado

```css
/* Ocultar placeholder completamente */
.insights-grid .react-grid-placeholder {
  display: none !important;
}

/* Remover transições para movimento instantâneo */
.insights-grid .react-grid-item {
  transition: none !important;
}

/* OU manter transição suave apenas para tamanho */
.insights-grid .react-grid-item:not(.react-draggable-dragging) {
  transition: width 200ms, height 200ms;
}
```

## Comportamento Esperado

### Antes (Atual)
```
┌─────────────────────────────────────────────────────────┐
│  Arrastar item:                                         │
│  → Aparece área sombreada (placeholder)                │
│  → Outros items são "empurrados"                        │
│  → Item "encaixa" em posições predefinidas              │
│  → Espaços vazios entre items                          │
└─────────────────────────────────────────────────────────┘
```

### Depois (PowerBI-style)
```
┌─────────────────────────────────────────────────────────┐
│  Arrastar item:                                         │
│  → Nenhum placeholder visível                          │
│  → Outros items NÃO são movidos                        │
│  → Item fica exatamente onde você solta                │
│  → Layout contíguo, sem gaps forçados                  │
└─────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Configuração Final do GridLayout

```typescript
<GridLayout
  className="layout"
  layout={layout}
  width={width}
  onLayoutChange={handleLayoutChange}
  gridConfig={{
    cols: COLS,
    rowHeight: ROW_HEIGHT,
    margin: [0, 0],           // Sem margens forçadas
    containerPadding: [0, 0],
  }}
  dragConfig={{
    enabled: true,
    handle: ".widget-drag-handle",
  }}
  resizeConfig={{
    enabled: true,
  }}
  compactor={freePositionCompactor}  // Posicionamento livre
/>
```

### Opções de Comportamento

| Configuração | Resultado |
|--------------|-----------|
| `getCompactor(null, false, true)` | Livre, mas não permite sobreposição (item volta se colidir) |
| `getCompactor(null, true, false)` | 100% livre, permite sobreposição total |

**Recomendação**: Usar `getCompactor(null, false, true)` para evitar sobreposição acidental, similar ao PowerBI onde items não ficam um sobre o outro.

### CSS Final para Ocultar Placeholder

```css
.insights-grid .react-grid-placeholder {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}

.insights-grid .react-grid-item {
  transition: none;
}

.insights-grid .react-grid-item.react-draggable-dragging {
  transition: none;
  z-index: 100;
}
```

## Resultado Final

O grid se comportará como o PowerBI:
- **Arraste livre**: Items movem para qualquer posição
- **Sem placeholders**: Nada aparece durante o arrasto
- **Sem empurrões**: Outros items permanecem em suas posições
- **Colisão bloqueada**: Se tentar soltar sobre outro item, volta para posição original
- **Redimensionamento livre**: Ajuste de tamanho sem restrições de grid

