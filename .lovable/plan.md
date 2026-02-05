
# Diagnóstico e Correção: Overflow de Mensagens no Grupo "Saulo & Winny"

## Problema Identificado

O grupo "Saulo & Winny - Eternum Club" apresenta mensagens que ultrapassam a margem direita da janela, enquanto outros grupos funcionam corretamente. A análise revelou que:

1. **Conteúdo específico do grupo**: As mensagens contêm formatação especial (listas com emojis `👉`, `✨`, `🧩`, texto multilinha com `*bold*`) enviadas pela "Anja Consultora Andréia"
2. **Textos longos preservados**: O uso de `whitespace-pre-wrap` preserva quebras de linha originais, mas quando combinado com palavras longas ou sequências de emojis, o container expande antes de quebrar

---

## Causa Raiz: Cadeia de Contenção Quebrada no Flexbox

O problema ocorre devido a uma **falha na propagação de restrição de largura** através da hierarquia de containers flexbox:

```text
┌─ AppLayout (overflow-hidden) ✓
│  └─ main (flex-1 min-w-0) ✓
│     └─ RoyZapp (flex-row overflow-hidden) ✓
│        └─ Container direito (flex-1 min-w-0) ✓
│           └─ ZappChatView (flex-col w-full overflow-hidden) ✓
│              └─ ZappMessagesList → ScrollArea ⚠️ PROBLEMA AQUI
│                 └─ Radix Viewport (w-full) 
│                    └─ div.space-y-1 ⛔ SEM RESTRIÇÃO DE LARGURA
│                       └─ ZappMessageBubble (max-w-[65%]) 
```

O **Radix ScrollArea Viewport** tem `w-full`, mas o container interno (`div.space-y-1`) não herda essa restrição. Quando há conteúdo que não quebra automaticamente (listas com emojis, formatações), o container interno calcula sua largura "ideal" baseada no conteúdo, ignorando o `overflow-hidden` do pai.

---

## Por que outros grupos funcionam?

Outros grupos têm mensagens mais curtas ou com formatação simples que o navegador consegue quebrar naturalmente. O grupo "Saulo & Winny" tem mensagens com:

- Listas formatadas (`👉 texto longo sem quebra natural`)
- Emojis em sequência (`✨🧩🎯`)
- Texto formatado com `*asteriscos*` que geram elementos `<strong>` inline

Esses elementos inline não quebram entre si, forçando o container a expandir.

---

## Solução em 3 Camadas

### Camada 1: Contenção no ScrollArea (ZappMessagesList.tsx)

Adicionar restrição de largura no container interno e forçar overflow hidden:

| Elemento | Antes | Depois |
|----------|-------|--------|
| ScrollArea | `flex-1 px-2 sm:px-4 py-2` | `flex-1 px-2 sm:px-4 py-2 overflow-hidden` |
| div interno | `space-y-1` | `space-y-1 w-full min-w-0` |

### Camada 2: Contenção no Container do Chat (ZappChatView.tsx)

Garantir que o container do chat não permita expansão horizontal:

| Antes | Depois |
|-------|--------|
| `flex flex-col flex-1 min-h-0 w-full bg-zapp-bg overflow-hidden` | `flex flex-col flex-1 min-h-0 w-full min-w-0 bg-zapp-bg overflow-hidden` |

O `min-w-0` é essencial em flex children para permitir que encolham abaixo do tamanho mínimo do conteúdo.

### Camada 3: Forçar quebra de texto na bolha (ZappMessageBubble.tsx)

Adicionar `overflow-wrap: anywhere` que é mais agressivo que `break-all` para elementos inline:

| Antes | Depois |
|-------|--------|
| `text-sm whitespace-pre-wrap break-words break-all overflow-hidden` | `text-sm whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere]` |

E remover `break-all` pois causa quebras feias no meio de palavras normais.

---

## Mudanças Específicas por Arquivo

### 1. `src/components/royzapp/ZappMessagesList.tsx`

**Linha 149:**
```tsx
// Antes
<ScrollArea className="flex-1 px-2 sm:px-4 py-2">

// Depois
<ScrollArea className="flex-1 px-2 sm:px-4 py-2 overflow-hidden">
```

**Linha 150:**
```tsx
// Antes
<div className="space-y-1">

// Depois
<div className="space-y-1 w-full min-w-0">
```

### 2. `src/components/royzapp/ZappChatView.tsx`

**Linha 238:**
```tsx
// Antes
<div className="flex flex-col flex-1 min-h-0 w-full bg-zapp-bg overflow-hidden">

// Depois
<div className="flex flex-col flex-1 min-h-0 w-full min-w-0 bg-zapp-bg overflow-hidden">
```

### 3. `src/components/royzapp/ZappMessageBubble.tsx`

**Linha 606:**
```tsx
// Antes
<p className="text-sm whitespace-pre-wrap break-words break-all overflow-hidden">

// Depois  
<p className="text-sm whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere]">
```

**Linha 612 (fallback para mensagens não suportadas):**
```tsx
// Antes
<p className="text-sm whitespace-pre-wrap break-words opacity-50">

// Depois
<p className="text-sm whitespace-pre-wrap break-words overflow-hidden [overflow-wrap:anywhere] opacity-50">
```

---

## Blindagem para Prevenir Regressões

### 1. Padrão CSS Obrigatório para Containers Flex
Sempre que um container flex precisar conter conteúdo variável, incluir:
- `min-w-0` no flex child para permitir encolhimento
- `overflow-hidden` no container do conteúdo
- `w-full` para forçar largura do container pai

### 2. Padrão para Texto de Mensagens
Qualquer parágrafo de texto que renderize conteúdo de usuário deve ter:
```css
whitespace-pre-wrap   /* preserva quebras de linha */
break-words           /* quebra palavras quando necessário */
overflow-hidden       /* esconde overflow residual */
[overflow-wrap:anywhere] /* quebra em qualquer ponto se necessário */
```

### 3. Memory Update Recomendado
Atualizar `memory/ui/roy-zapp-chat-layout-integrity` com o padrão de contenção flexbox para referência futura.

---

## Resumo Visual da Correção

```text
ANTES:
┌──────────────────────────────────────────────┐
│ Container                                     │
│ ┌──────────────────────────────────────────────────────────┐
│ │ Bolha que ultrapassa o limite ──────────────────────▶    │
│ └──────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────┘

DEPOIS:
┌──────────────────────────────────────────────┐
│ Container (min-w-0, overflow-hidden)         │
│ ┌─────────────────────────────────┐          │
│ │ Bolha contida corretamente      │          │
│ │ com texto que quebra quando     │          │
│ │ necessário ✓                    │          │
│ └─────────────────────────────────┘          │
└──────────────────────────────────────────────┘
```
