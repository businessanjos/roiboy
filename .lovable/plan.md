

# Diagnóstico Definitivo: Overflow Horizontal no Grupo "Saulo & Winny"

## Causa Raiz Identificada

### O Bug do Radix ScrollArea: `display: table`

O componente `ScrollArea` do Radix UI usa internamente uma estrutura com `display: table` no container de conteúdo do Viewport. Esta é uma escolha deliberada do Radix para calcular corretamente o tamanho do conteúdo para as scrollbars.

**Porém, isso causa um problema crítico:**

```text
┌─ ScrollArea.Root (overflow: hidden) ✓
│  └─ ScrollArea.Viewport (w-full h-full)
│     └─ div [INTERNO DO RADIX - NÃO CONTROLAMOS]
│        │  style="display: table; min-width: 100%"  ⚠️ PROBLEMA
│        │
│        └─ Nosso conteúdo (space-y-1 w-full min-w-0)
│           └─ ZappMessageBubble (max-w-[65%])
│              └─ <strong>😇 Anja...</strong> + emojis em sequência
│                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
│                 Estes elementos INLINE não quebram entre si!
│                 O "display: table" EXPANDE para acomodá-los.
```

### Por que só acontece neste grupo?

1. **Conteúdo específico**: As mensagens da "Anja Consultora Andréia" contêm:
   - Formatação bold com asteriscos (`*texto*` → `<strong>texto</strong>`)
   - Emojis em sequência como prefixos de lista (`👉`, `🧩`, `✨`)
   - Textos longos (300-428 caracteres) com múltiplas quebras de linha

2. **Comportamento do `display: table`**: 
   - Quando há elementos inline que não podem quebrar (como `<strong>` com emojis), o container "table" expande horizontalmente
   - Ele ignora o `max-w-[65%]` do container pai porque calcula a largura "ideal" do conteúdo primeiro

3. **A barra de rolagem horizontal**: Aparece porque o Viewport do Radix permite que seu conteúdo interno (o "table") seja mais largo que o próprio Viewport.

---

## Solução Definitiva

### Estratégia: Forçar o Viewport do Radix a respeitar limites

Precisamos adicionar uma regra CSS que force o container interno do Radix (o `display: table`) a respeitar a largura do pai.

### Mudança 1: Modificar o componente ScrollArea

**Arquivo**: `src/components/ui/scroll-area.tsx`

Adicionar estilos que forcem o container interno a não expandir além do pai:

```tsx
// ANTES (linha 15)
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">

// DEPOIS
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] !overflow-x-hidden [&>div]:!table-fixed [&>div]:!w-full">
```

**Explicação:**
- `!overflow-x-hidden`: Força o Viewport a ocultar overflow horizontal com !important
- `[&>div]:!table-fixed`: Aplica `table-layout: fixed` ao div interno do Radix, forçando-o a respeitar a largura do container
- `[&>div]:!w-full`: Força o div interno a usar 100% da largura do pai

### Mudança 2: Garantir contenção na lista de mensagens

**Arquivo**: `src/components/royzapp/ZappMessagesList.tsx`

Remover `overflow-hidden` do ScrollArea (pois agora o ScrollArea já lida com isso):

```tsx
// ANTES (linha 149)
<ScrollArea className="flex-1 px-2 sm:px-4 py-2 overflow-hidden">

// DEPOIS
<ScrollArea className="flex-1 px-2 sm:px-4 py-2">
```

### Mudança 3: Blindar o texto das bolhas de mensagem

**Arquivo**: `src/components/royzapp/ZappMessageBubble.tsx`

Manter as classes já aplicadas e adicionar `min-w-0` à bolha interna:

Na linha 325 (container da bolha):
```tsx
// ANTES
"px-3 py-2 rounded-lg relative shadow overflow-hidden flex-1 min-w-0 transition-all duration-300"

// DEPOIS (manter como está - já tem min-w-0 e overflow-hidden)
"px-3 py-2 rounded-lg relative shadow overflow-hidden flex-1 min-w-0 transition-all duration-300"
```

---

## Por que esta solução funciona?

```text
ANTES (com display: table expandindo):
┌──────────────── Viewport ────────────────┐
│ ┌───────────── div (table) ─────────────────────────────────┐
│ │ Conteúdo com emojis e formatação que EXPANDE →────────────│
│ └───────────────────────────────────────────────────────────┘
│                                          │ ← scrollbar aparece
└──────────────────────────────────────────┘

DEPOIS (com table-fixed + w-full):
┌──────────────── Viewport ────────────────┐
│ ┌──────────── div (table-fixed) ────────┐│
│ │ Conteúdo agora QUEBRA corretamente    ││
│ │ porque table-layout: fixed força      ││
│ │ a largura a ser respeitada            ││
│ └───────────────────────────────────────┘│
└──────────────────────────────────────────┘ ← sem scrollbar!
```

---

## Blindagem para Prevenir Regressões Futuras

### Padrão 1: ScrollArea sempre com contenção horizontal
Sempre que usar `ScrollArea` para conteúdo vertical, o componente agora automaticamente previne overflow horizontal.

### Padrão 2: Containers flexbox com conteúdo variável
Continuar usando `min-w-0` em todos os flex children que contenham texto de usuário.

### Padrão 3: Texto de usuário com quebra agressiva
Manter `[overflow-wrap:anywhere]` em qualquer `<p>` que renderize conteúdo de usuário.

---

## Resumo das Mudanças

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/components/ui/scroll-area.tsx` | 15 | Adicionar `!overflow-x-hidden [&>div]:!table-fixed [&>div]:!w-full` ao Viewport |
| `src/components/royzapp/ZappMessagesList.tsx` | 149 | Remover `overflow-hidden` (agora redundante) |

---

## Referências Técnicas

- [Radix Issue #2722](https://github.com/radix-ui/primitives/issues/2722): Confirma que `display: table` causa expansão horizontal
- [Radix Issue #3129](https://github.com/radix-ui/primitives/issues/3129): Discussão sobre persistência do problema
- `table-layout: fixed`: Propriedade CSS que força tabelas a respeitar a largura definida em vez de calcular baseado no conteúdo

