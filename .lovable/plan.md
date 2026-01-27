

# Plano: Aumentar Espaço e Flexibilidade dos Painéis de Insights

## Problema Identificado

Os painéis de insights estão com delimitações muito restritivas, impedindo posicionamento livre dos visuais. Analisando a imagem enviada e o código, identifiquei os seguintes limitadores:

| Configuração Atual | Valor | Resultado |
|-------------------|-------|-----------|
| `ROW_HEIGHT` | 80px | Cada unidade de altura = 80px |
| `minW` (largura mínima) | 3 colunas | Visual não pode ser menor que 25% da tela |
| `minH` (altura mínima) | 3 unidades | Visual mínimo de 240px de altura |
| Tamanho padrão | 6×4 | Metade da largura, 320px de altura |
| Grid | 12 colunas | Adequado, não precisa mudar |

---

## Solução Proposta

### 1. Reduzir Tamanhos Mínimos para Maior Flexibilidade

Permitir visuais menores e mais compactos quando desejado:

**Antes:**
- `minW: 3` (25% da tela)
- `minH: 3` (240px)

**Depois:**
- `minW: 2` (16.6% da tela) - permite até 6 visuais lado a lado
- `minH: 2` (120px) - permite scorecards mais compactos

### 2. Aumentar Tamanho Padrão para Novos Visuais

Visuais novos começarão maiores para melhor visualização:

**Antes:**
- Largura padrão: 6 colunas (metade)
- Altura padrão: 4 unidades (320px)

**Depois:**
- Largura padrão: 6 colunas (mantém)
- Altura padrão: 5 unidades (400px) - mais espaço para gráficos

### 3. Aumentar Altura da Linha para Mais Espaço Vertical

A mudança mais impactante - cada unidade de altura ocupará mais pixels:

**Antes:** `ROW_HEIGHT = 80px`
**Depois:** `ROW_HEIGHT = 100px`

Isso significa:
- Visual de altura 4 → 400px (antes era 320px)
- Visual de altura 5 → 500px (antes era 400px)
- Visual de altura 6 → 600px (painel grande)

### 4. Permitir Visuais Maiores (Sem Limite Máximo)

Adicionar suporte para que visuais cresçam tanto quanto o usuário desejar, sem limites artificiais de largura ou altura.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/insights/grid/InsightsGrid.tsx` | Ajustar `ROW_HEIGHT`, `minW`, `minH`, e tamanhos padrão |

---

## Resultado Esperado

```
ANTES (Configuração atual)
┌─────────────┬─────────────┐
│  Visual A   │  Visual B   │  ← Altura limitada, pouco espaço
│  (pequeno)  │  (pequeno)  │
└─────────────┴─────────────┘

DEPOIS (Nova configuração)
┌─────────────────────────────┐
│         Visual A            │  ← Pode ocupar largura total
│       (altura maior)        │
│                             │
├────────────┬────────────────┤
│  Visual B  │   Visual C     │  ← Ou lado a lado com mais altura
│            │                │
└────────────┴────────────────┘
```

---

## Seção Técnica

### Alterações no InsightsGrid.tsx

```typescript
// Linha 23-25: Aumentar constantes
const ROW_HEIGHT = 100;  // Era 80 → Agora 100px por unidade
const COLS = 12;         // Mantém
const MARGIN: [number, number] = [16, 16]; // Mantém

// Linhas 50-72: Ajustar layouts
// Reduzir minW e minH para maior flexibilidade
{
  i: visual.id,
  x: existingLayout.x,
  y: existingLayout.y,
  w: existingLayout.w,
  h: existingLayout.h,
  minW: 2,  // Era 3 → Agora 2 (mais compacto)
  minH: 2,  // Era 3 → Agora 2 (mais compacto)
}

// Layout padrão para novos visuais
{
  i: visual.id,
  x: (index % 2) * 6,
  y: Math.floor(index / 2) * 5,  // Era 4 → Agora 5
  w: 6,
  h: 5,     // Era 4 → Agora 5 (mais altura)
  minW: 2,  // Era 3 → Agora 2
  minH: 2,  // Era 3 → Agora 2
}
```

### Comparação de Tamanhos

| Medida | Antes | Depois | Ganho |
|--------|-------|--------|-------|
| Altura mínima | 240px (3×80) | 200px (2×100) | Mais compacto |
| Altura padrão | 320px (4×80) | 500px (5×100) | +56% espaço |
| Altura máxima | Ilimitada | Ilimitada | ✓ |
| Largura mínima | 25% | 16.6% | Mais flexível |

