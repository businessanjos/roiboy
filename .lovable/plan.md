
# Plano: Grid de Posicionamento Ultra-Granular (Estilo PowerBI)

## Problema Raiz

O `react-grid-layout` é **fundamentalmente baseado em grid** - os itens sempre "encaixam" em células de colunas/linhas. A configuração atual:

| Parâmetro | Valor Atual | Resultado |
|-----------|-------------|-----------|
| `cols` | 12 | ~83px por coluna (em tela de 1000px) |
| `rowHeight` | 100px | 100px por linha |

Isso significa que ao arrastar, o item "pula" em incrementos de ~83px horizontal e 100px vertical - por isso parece haver posições "predefinidas".

## Solução: Grid Ultra-Fino

Para simular posicionamento livre como no PowerBI, precisamos aumentar drasticamente a granularidade do grid:

| Parâmetro | Valor Atual | Novo Valor | Resultado |
|-----------|-------------|------------|-----------|
| `cols` | 12 | 48 | ~21px por coluna (snap quase imperceptível) |
| `rowHeight` | 100px | 20px | 20px por linha (movimento suave) |

Com esta configuração:
- Movimento horizontal: snap de ~21px (em tela 1000px)
- Movimento vertical: snap de 20px
- Usuário percebe como "livre"

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/insights/grid/InsightsGrid.tsx` | Mudar `COLS` para 48 e `ROW_HEIGHT` para 20 |

## Código Proposto

```typescript
// Antes
const ROW_HEIGHT = 100;
const COLS = 12;

// Depois
const ROW_HEIGHT = 20;  // 5x mais granular verticalmente
const COLS = 48;        // 4x mais granular horizontalmente
```

### Ajuste de Layouts Existentes

Os layouts salvos no banco de dados usam o sistema de 12 colunas. Para manter compatibilidade:

```typescript
// Converter layout antigo (12 cols) para novo (48 cols)
const layout = useMemo<LayoutItem[]>(() => {
  return visuals.map((visual, index) => {
    const existingLayout = visual.layout;
    
    if (existingLayout) {
      // Multiplicar x e w por 4 para converter de 12→48 colunas
      // Multiplicar y e h por 5 para converter de 100px→20px rowHeight
      return {
        i: visual.id,
        x: existingLayout.x * 4,
        y: existingLayout.y * 5,
        w: existingLayout.w * 4,
        h: existingLayout.h * 5,
        minW: 4,  // equivalente ao antigo minW: 1
        minH: 5,  // equivalente ao antigo minH: 1
      };
    }

    // Default layout para novos visuais
    return {
      i: visual.id,
      x: (index % 2) * 24,  // 24 cols = metade do grid
      y: Math.floor(index / 2) * 25,  // 25 rows = ~500px
      w: 24,  // metade da largura
      h: 25,  // ~500px de altura
      minW: 4,
      minH: 5,
    };
  });
}, [visuals]);

// Ao salvar, converter de volta para escala 12 cols / 100px rows
const handleLayoutChange = useCallback(
  (newLayout: LayoutItem[]) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const layoutUpdates = newLayout.map((item) => ({
        id: item.i,
        layout: {
          i: item.i,
          x: Math.round(item.x / 4),  // Converter para 12 cols
          y: Math.round(item.y / 5),  // Converter para 100px rows
          w: Math.round(item.w / 4),
          h: Math.round(item.h / 5),
        },
      }));

      onLayoutChange(layoutUpdates);
    }, 500);
  },
  [onLayoutChange]
);
```

## Comportamento Visual

```text
┌─────────────────────────────────────────────────────────────┐
│                   ANTES (Grid 12x100)                       │
├─────────────────────────────────────────────────────────────┤
│  Arrastar visual:                                           │
│  → Pula em incrementos de ~83px (horizontal)               │
│  → Pula em incrementos de 100px (vertical)                 │
│  → Usuário percebe "encaixe forçado"                       │
└─────────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────────┐
│                   DEPOIS (Grid 48x20)                       │
├─────────────────────────────────────────────────────────────┤
│  Arrastar visual:                                           │
│  → Pula em incrementos de ~21px (horizontal)               │
│  → Pula em incrementos de 20px (vertical)                  │
│  → Usuário percebe como "movimento livre"                  │
└─────────────────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Conversão de Escala

Para manter compatibilidade com layouts existentes salvos no banco:

| Operação | Fórmula |
|----------|---------|
| **Leitura** (DB → Grid) | `x * 4`, `y * 5`, `w * 4`, `h * 5` |
| **Escrita** (Grid → DB) | `x / 4`, `y / 5`, `w / 4`, `h / 5` |

### Tamanhos Mínimos

| Parâmetro | Antes | Depois | Equivalência |
|-----------|-------|--------|--------------|
| `minW` | 2 | 8 | ~2 colunas antigas |
| `minH` | 2 | 10 | ~200px |

## Resultado Esperado

- **Movimento fluido**: Snap de 20-21px é quase imperceptível
- **Posicionamento preciso**: Usuário pode colocar visuais exatamente onde deseja
- **Sem "pulos"**: Transição suave durante o arrasto
- **Compatibilidade**: Layouts existentes são convertidos automaticamente

## Limitação

O `react-grid-layout` sempre terá algum nível de "snap" porque é baseado em grid. Para posicionamento **100% livre em pixels**, seria necessário substituir por uma biblioteca como `react-rnd` (draggable + resizable sem grid). Porém, com grid 48x20, o snap é tão pequeno que a maioria dos usuários não perceberá.
