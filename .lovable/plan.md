
# Plano: Permitir Posicionamento Livre com Espaçamentos no Grid de Insights

## Problema Identificado

Ao arrastar visuais no dashboard de Insights, quando o visual fica próximo de outro, ele "gruda" (snap) automaticamente, impedindo que você deixe espaçamentos personalizados entre os visuais.

## Causa Raiz

No arquivo `src/components/insights/grid/InsightsGrid.tsx`, o compactor está configurado como:

```typescript
const freePositionCompactor = getCompactor(null, false, true);
```

Os parâmetros são:
| Parâmetro | Valor Atual | Significado |
|-----------|-------------|-------------|
| `type` | `null` | Sem compactação automática |
| `allowOverlap` | `false` | **Não permite sobreposição** |
| `preventCollision` | `true` | **Bloqueia movimento para evitar colisão** |

O problema: com `preventCollision: true`, quando você arrasta um item próximo a outro, o grid **bloqueia** a posição para evitar que os itens se toquem, causando o efeito de "snap".

## Solução Proposta

Alterar a configuração do compactor para permitir posicionamento totalmente livre:

```typescript
// DE (configuração atual):
const freePositionCompactor = getCompactor(null, false, true);

// PARA (nova configuração):
const freePositionCompactor = getCompactor(null, true, false);
```

Novos parâmetros:
| Parâmetro | Novo Valor | Resultado |
|-----------|------------|-----------|
| `type` | `null` | Mantém sem compactação |
| `allowOverlap` | `true` | **Permite posicionar livremente** |
| `preventCollision` | `false` | **Não bloqueia movimento** |

## Comportamento Esperado Após a Mudança

1. **Posicionamento livre**: Você poderá colocar visuais em qualquer posição do grid
2. **Espaçamentos personalizados**: Será possível deixar gaps entre visuais conforme desejado
3. **Sobreposição permitida**: Se arrastar um visual sobre outro, ele ficará sobreposto (comportamento PowerBI)
4. **Sem snap automático**: Os visuais não "grudarão" uns nos outros

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/insights/grid/InsightsGrid.tsx` | Alterar linha 10 para usar `getCompactor(null, true, false)` |

## Detalhes Técnicos

A mudança é de uma única linha:

```diff
- const freePositionCompactor = getCompactor(null, false, true);
+ const freePositionCompactor = getCompactor(null, true, false);
```

Também atualizarei o comentário explicativo:

```diff
- // Free position compactor: no compaction, prevents collision, items don't push others
+ // Free position compactor: no compaction, allows overlap, true free-form positioning
```

## Nota sobre Sobreposição

Com `allowOverlap: true`, será possível sobrepor visuais. Este é o comportamento esperado em dashboards estilo PowerBI, onde o usuário tem controle total sobre o layout. Se um visual ficar sobre outro acidentalmente, basta arrastá-lo para corrigir.
