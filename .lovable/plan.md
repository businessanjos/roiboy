

# Plano: Corrigir Overflow na Janela de Nova Conversa

## Diagnóstico do Problema

### O Que Está Acontecendo

A barra de pesquisa e as informações do grupo (nome + badge) estão transbordando os limites do dialog, como mostrado na screenshot.

### Causas Identificadas

| Elemento | Problema | Causa |
|----------|----------|-------|
| Input de busca | Ultrapassa borda direita | Falta `overflow-hidden` no container |
| Nome do grupo | Transborda horizontalmente | `whitespace-nowrap` força texto em uma linha |
| Badge "Grupo" | Fica fora da área visível | Container flex não limita largura |

### Análise do Código Atual

```tsx
// Linha 124-127 - Problema: whitespace-nowrap + nome longo = overflow
<div className="flex items-center gap-2">
  <span className="text-[#e9edef] font-medium whitespace-nowrap">
    {formatName(client.full_name, client.type)}  // Até 40 chars para grupos
  </span>
  <Badge>Grupo</Badge>  // Badge empurrada para fora
</div>
```

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/royzapp/dialogs/ZappNewConversationDialog.tsx` | Adicionar controle de overflow nos containers |

## Solução Proposta

### 1. Adicionar `overflow-hidden` no DialogContent

```tsx
<DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef] max-w-md overflow-hidden">
```

### 2. Corrigir Container Principal do Item

```tsx
// Linha 96 - Container do espaço de pesquisa
<div className="space-y-4 py-4 overflow-hidden">
```

### 3. Corrigir Layout do Nome + Badge

A solução principal é mudar o layout para `flex-wrap` e permitir que o nome quebre se necessário:

```tsx
// Antes (linha 124):
<div className="flex items-center gap-2">
  <span className="text-[#e9edef] font-medium whitespace-nowrap">

// Depois:
<div className="flex items-center gap-2 flex-wrap overflow-hidden">
  <span className="text-[#e9edef] font-medium truncate max-w-[200px]">
```

### 4. Ajustar Container do Conteúdo do Item

```tsx
// Linha 123 - Garantir que flex-1 min-w-0 funcione
<div className="flex-1 min-w-0 overflow-hidden">
```

## Mudanças Detalhadas

### Modificação 1: DialogContent
Adicionar `overflow-hidden` para garantir que nenhum conteúdo vaze:

```tsx
<DialogContent className="bg-[#2a3942] border-[#3b4a54] text-[#e9edef] max-w-md overflow-hidden">
```

### Modificação 2: Container de Conteúdo
Adicionar `overflow-hidden` no wrapper:

```tsx
<div className="space-y-4 py-4 overflow-hidden">
```

### Modificação 3: Container Flex do Nome
Mudar de `whitespace-nowrap` para `truncate` com largura máxima:

```tsx
<div className="flex items-center gap-2 flex-wrap min-w-0 overflow-hidden">
  <span className="text-[#e9edef] font-medium truncate max-w-[180px] sm:max-w-[220px]">
    {formatName(client.full_name, client.type)}
  </span>
```

### Modificação 4: Container do Item de Contato
Garantir que o overflow seja controlado:

```tsx
<div className="flex-1 min-w-0 overflow-hidden">
```

## Resultado Esperado

### Antes (Atual)
- Input e nome do grupo ultrapassam bordas do dialog
- Badge "Grupo" fica parcialmente oculta ou fora da área

### Depois (Corrigido)
- Todo conteúdo respeitará os limites do dialog
- Nomes longos serão truncados com "..."
- Badge permanecerá visível e alinhada
- Layout consistente em todas as larguras de tela

## Fluxo Visual

```text
┌─────────────────────────────────────────────┐
│  Nova Conversa                          [X] │
│  Busque um contato para iniciar uma conversa│
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ Henrique                            │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [AV] +5527996514210                        │
│                                             │
│  [DR] Dr. Henrique Nakatani    [Contato]   │
│       +5541999217575                        │
│                                             │
│  [HE] Henrique & Leticia - E... [🔵 Grupo] │ ← Truncado
│       Grupo do WhatsApp                     │
│                                             │
└─────────────────────────────────────────────┘
```

## Benefícios

| Aspecto | Descrição |
|---------|-----------|
| **Responsividade** | Conteúdo nunca ultrapassa bordas |
| **Legibilidade** | Nomes truncados ainda identificáveis |
| **UX Consistente** | Layout previsível em qualquer dispositivo |
| **Acessibilidade** | Badges sempre visíveis |

