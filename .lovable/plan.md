

# Plano: Preservar Espaçamentos no Grid Ultra-Granular

## Problema Identificado

O problema é a **perda de precisão** no arredondamento das coordenadas:

1. O usuário posiciona os visuais com espaçamento (ex: x=25, y=30)
2. Ao salvar, divide por 4/5 e arredonda: `Math.round(25/4) = 6`
3. Ao carregar, multiplica de volta: `6 * 4 = 24`
4. Resultado: visual "pulou" 1 célula, perdendo o espaçamento

Isso acontece porque o banco armazena em **escala 12 cols/100px**, mas o grid usa **escala 48 cols/20px**. A conversão arredonda e perde os espaçamentos finos.

## Solução: Armazenar Diretamente na Escala Granular

Ao invés de converter entre escalas, armazenar os valores diretamente na escala granular (48 cols/20px rows) no banco de dados. Isso preserva a precisão exata do posicionamento.

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/insights/grid/InsightsGrid.tsx` | Remover conversão de escala - salvar/carregar valores diretamente |

## Mudanças Específicas

### 1. Remover Multiplicação ao Carregar

```typescript
// ANTES: Converte de 12→48 cols
x: existingLayout.x * 4,
y: existingLayout.y * 5,

// DEPOIS: Usa valores diretamente
x: existingLayout.x,
y: existingLayout.y,
```

### 2. Remover Divisão ao Salvar

```typescript
// ANTES: Converte de 48→12 cols (arredonda e perde precisão)
x: Math.round(item.x / 4),
y: Math.round(item.y / 5),

// DEPOIS: Salva valores diretamente
x: item.x,
y: item.y,
```

### 3. Ajustar Layout Padrão para Novos Visuais

Os novos visuais já usam a escala granular (48 cols), então apenas precisamos garantir que tenham tamanhos razoáveis com espaçamento:

```typescript
// Default layout para novos visuais
return {
  i: visual.id,
  x: (index % 2) * 26,      // 26 = card de 24 + gap de 2 (~40px)
  y: Math.floor(index / 2) * 27,  // 27 = card de 25 + gap de 2
  w: 24,
  h: 25,
  minW: 8,
  minH: 10,
};
```

## Comportamento Esperado

```text
┌─────────────────────────────────────────────────────────────┐
│                   ANTES (Com Arredondamento)                │
├─────────────────────────────────────────────────────────────┤
│  Usuário posiciona: x=25 (com gap de 1 célula)              │
│  Salva: Math.round(25/4) = 6                                │
│  Carrega: 6 * 4 = 24  ← GAP PERDIDO!                       │
│  Resultado: visuais colados                                 │
└─────────────────────────────────────────────────────────────┘

                          ↓

┌─────────────────────────────────────────────────────────────┐
│                   DEPOIS (Sem Conversão)                    │
├─────────────────────────────────────────────────────────────┤
│  Usuário posiciona: x=25                                    │
│  Salva: x=25                                                │
│  Carrega: x=25  ← PRESERVADO!                              │
│  Resultado: espaçamento mantido                             │
└─────────────────────────────────────────────────────────────┘
```

## Considerações Importantes

### Visuais Existentes

Os visuais que já existem no banco estão na escala antiga (12 cols). Para não quebrá-los, podemos detectar se o valor é da escala antiga (valores pequenos como 0-12) e converter apenas esses:

```typescript
// Detectar se é layout antigo (escala 12 cols) ou novo (escala 48 cols)
const isOldScale = existingLayout.x <= 12 && existingLayout.w <= 12;

if (isOldScale) {
  // Converter de escala antiga para nova
  return {
    x: existingLayout.x * 4,
    y: existingLayout.y * 5,
    w: existingLayout.w * 4,
    h: existingLayout.h * 5,
    ...
  };
} else {
  // Usar valores diretamente
  return {
    x: existingLayout.x,
    y: existingLayout.y,
    w: existingLayout.w,
    h: existingLayout.h,
    ...
  };
}
```

## Resumo das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Escala do DB** | 12 cols / 100px rows | 48 cols / 20px rows |
| **Conversão ao carregar** | `x * 4`, `y * 5` | Direto (ou detecta escala) |
| **Conversão ao salvar** | `Math.round(x / 4)` | Direto |
| **Precisão** | Perde espaçamentos | Preserva exatamente |

## Resultado Final

- Espaçamentos entre visuais são **preservados exatamente**
- Visuais permanecem onde o usuário os posicionou
- Compatibilidade com layouts antigos via detecção de escala

