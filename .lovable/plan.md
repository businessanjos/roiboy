

# Plano: Corrigir Posicionamento do Botão "Salvar Alterações" no Sheet de Ajustes

## Diagnóstico do Problema

### O Que Está Acontecendo

Na screenshot, o botão "Salvar Alterações" aparece **fora** do painel lateral direito (Sheet), posicionado no canto inferior esquerdo da tela.

### Causas Identificadas

| Problema | Causa |
|----------|-------|
| SheetContent sem estrutura flex | Conteúdo não está organizado em colunas flexíveis |
| SheetFooter com classes conflitantes | Classes padrão `sm:flex-row sm:justify-end` quebram o layout vertical |
| Conteúdo sem limitação de altura | O conteúdo do meio pode estar transbordando |

### Análise do Código Atual

```tsx
// Linha 146: SheetContent sem flex layout
<SheetContent side="right" className="w-[340px] sm:w-[400px]">

// Linha 154: Conteúdo central sem scroll ou limitações
<div className="py-6 space-y-6">

// Linha 211: SheetFooter padrão com classes problemáticas
<SheetFooter className="flex flex-col gap-4">
  // SheetFooter base tem: sm:flex-row sm:justify-end sm:space-x-2 (conflita!)
```

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/insights/visuals/VisualQuickSettings.tsx` | Corrigir estrutura do layout do Sheet |

## Solução Proposta

### 1. Adicionar estrutura flex ao SheetContent

O `SheetContent` precisa ter `flex flex-col h-full` para organizar header, conteúdo e footer corretamente:

```tsx
<SheetContent side="right" className="w-[340px] sm:w-[400px] flex flex-col">
```

### 2. Tornar o conteúdo central scrollável

O conteúdo do meio deve ter `flex-1 overflow-y-auto` para ocupar o espaço disponível e permitir scroll:

```tsx
<div className="py-6 space-y-6 flex-1 overflow-y-auto">
```

### 3. Corrigir SheetFooter para layout vertical fixo

Substituir a classe padrão conflitante por um layout fixo no final:

```tsx
<SheetFooter className="flex flex-col gap-4 pt-4 mt-auto border-t">
```

Ou usar uma div em vez de SheetFooter para evitar conflitos:

```tsx
<div className="flex flex-col gap-4 pt-4 mt-auto border-t flex-shrink-0">
```

## Detalhes da Implementação

### Modificação Completa

```tsx
return (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-[340px] sm:w-[400px] flex flex-col">
      <SheetHeader>
        <SheetTitle>Ajustes do Visual</SheetTitle>
        <SheetDescription className="truncate">
          {visual.title || "Visual sem título"}
        </SheetDescription>
      </SheetHeader>

      {/* Conteúdo scrollável */}
      <div className="py-6 space-y-6 flex-1 overflow-y-auto">
        {/* ... conteúdo existente ... */}
      </div>

      {/* Footer fixo na base */}
      <div className="flex flex-col gap-4 pt-4 mt-auto border-t flex-shrink-0">
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </Button>
        
        <Separator />
        
        <div className="space-y-2">
          {/* ... zona de perigo ... */}
        </div>
      </div>
    </SheetContent>
  </Sheet>
);
```

## Resultado Esperado

### Antes (Bug Atual)
- Botão "Salvar Alterações" fora do painel
- Layout desorganizado

### Depois (Corrigido)
- Painel com estrutura flex vertical
- Conteúdo scrollável no centro
- Botões fixos na base do painel
- Layout consistente em qualquer altura de conteúdo

## Fluxo Visual Corrigido

```text
┌─────────────────────────────────────┐
│  Ajustes do Visual              [X] │  ← Header (flex-shrink-0)
│  Faturamento                        │
├─────────────────────────────────────┤
│                                     │
│  Formatação do Valor                │
│  [Escala de Exibição    ▼]          │  ← Conteúdo (flex-1 overflow-y-auto)
│  [Casas Decimais        ▼]          │
│                                     │
│  Personalização Visual              │
│  [Paletas de cores...]              │
│                                     │
├─────────────────────────────────────┤
│  [    Salvar Alterações    ]        │  ← Footer (flex-shrink-0 mt-auto)
│  ───────────────────────────        │
│         Zona de Perigo              │
│  [🗑️   Excluir Visual     ]        │
└─────────────────────────────────────┘
```

## Benefícios

| Aspecto | Descrição |
|---------|-----------|
| **Layout correto** | Todos os elementos dentro do painel |
| **Scroll funcional** | Conteúdo longo não quebra o layout |
| **Footer fixo** | Botões sempre visíveis e acessíveis |
| **Responsividade** | Funciona em diferentes alturas de tela |

