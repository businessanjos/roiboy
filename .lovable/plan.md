

## Corrigir Proporção das Barras do Funil com Escala Não-Linear

### Problema
A escala linear `cumValue / maxValue` cria saltos enormes: "Contato Realizado" = 60%, "Em Qualificação" = 14%, etapas com 2-3 itens = 3-4%. As barras pequenas ficam ilegíveis.

### Solução: Escala Raiz Quadrada
Usar `sqrt(cumValue) / sqrt(maxValue)` em vez de `cumValue / maxValue`. Isso comprime o range, mantendo hierarquia visível mas com barras legíveis.

Com os dados atuais (max=70):
| Etapa | Valor Cum. | Linear | Sqrt |
|-------|-----------|--------|------|
| Chegou Lead | 70 | 100% | 100% |
| Contato Realizado | 42 | 60% | 77% |
| Em Qualificação | 10 | 14% | 38% |
| 3 itens | 3 | 4% | 21% |
| 2 itens | 2 | 3% | 17% |

A hierarquia fica clara (38% > 21% > 17%) e todas as barras são legíveis.

### Alteração — `ConfigurableFunnel.tsx`

**Linha 51** — Trocar cálculo linear por sqrt:
```typescript
// De:
const widthPct = Math.max((cumValue / maxValue) * 100, 10);
// Para:
const widthPct = Math.max((Math.sqrt(cumValue) / Math.sqrt(maxValue)) * 100, 15);
```

**Linha 89** — Mesma lógica para Ganhos:
```typescript
const ganhosWidthPct = Math.max((Math.sqrt(ganhosItem.value) / Math.sqrt(maxValue)) * 100, 15);
```

**Linhas 63, 92** — Restaurar `minWidth: '120px'` para garantir legibilidade mínima.

