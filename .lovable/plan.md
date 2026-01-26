
# Plano: Fixar Barra de Comentários no Perfil do Cliente

## Problema

Quando a Timeline ou as abas de Financeiro possuem muitas informações, os usuários precisam rolar até o final da página para acessar a caixa de comentário/anexo. Isso prejudica a usabilidade.

## Componentes Afetados

| Componente | Local do Input | Problema |
|------------|----------------|----------|
| `Timeline.tsx` | Final da lista | Fica escondido quando há muitos eventos |
| `FinancialNotes.tsx` | Topo da lista | OK, mas pode melhorar com scroll |
| `ClientFinancial.tsx` (aba Lançamentos) | Topo | Usa `FinancialQuickNoteInput` |

## Solução Proposta

Reestruturar o layout para usar um container flex com altura definida:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           ESTRUTURA ATUAL                                  │
└────────────────────────────────────────────────────────────────────────────┘

   Timeline.tsx                        FinancialNotes.tsx
┌─────────────────────────┐         ┌─────────────────────────┐
│  Evento 1               │         │  Input (topo)           │
│  Evento 2               │         │  Nota 1                 │
│  Evento 3               │         │  Nota 2                 │
│  ...                    │         │  ...                    │
│  Evento N               │         │  Nota N                 │
│  ────────────────────── │         └─────────────────────────┘
│  Input (fundo)          │
│  (precisa rolar)        │
└─────────────────────────┘


┌────────────────────────────────────────────────────────────────────────────┐
│                           ESTRUTURA NOVA                                   │
└────────────────────────────────────────────────────────────────────────────┘

   Timeline.tsx                        FinancialNotes.tsx
┌─────────────────────────┐         ┌─────────────────────────┐
│ ┌─────────────────────┐ │         │ ┌─────────────────────┐ │
│ │  Evento 1           │ │         │ │  Nota 1             │ │
│ │  Evento 2           │ │         │ │  Nota 2             │ │
│ │  Evento 3           │ │         │ │  ...                │ │
│ │  ...                │ │         │ │  Nota N             │ │
│ │  (scrollable)       │ │         │ │  (scrollable)       │ │
│ └─────────────────────┘ │         │ └─────────────────────┘ │
│ ────────────────────────│         │ ────────────────────────│
│ Input (fixo no fundo)   │         │ Input (fixo no fundo)   │
│ sempre visível          │         │ sempre visível          │
└─────────────────────────┘         └─────────────────────────┘
```

## Alterações por Arquivo

### 1. `src/components/client/Timeline.tsx`

Modificar o wrapper principal para:
- Usar `flex flex-col` com altura máxima (ex: `max-h-[600px]`)
- Lista de eventos dentro de um container com `flex-1 overflow-y-auto`
- Input permanece fora do container scrollable (no fundo)

```tsx
// Estrutura nova:
<div className="flex flex-col max-h-[600px]">
  {/* Lista scrollable */}
  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
    {/* eventos aqui */}
  </div>
  
  {/* Input fixo no fundo */}
  <div className="flex-shrink-0 pt-4 border-t bg-background">
    {/* comment input */}
  </div>
</div>
```

### 2. `src/components/client/FinancialNotes.tsx`

Aplicar a mesma estrutura:
- Container flex com altura máxima
- Lista de notas scrollable
- Input MOVIDO para o fundo (atualmente está no topo)

```tsx
<div className="flex flex-col max-h-[600px]">
  {/* Lista scrollable */}
  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
    {notes.map(...)}
  </div>
  
  {/* Input fixo no fundo */}
  <div className="flex-shrink-0 pt-4 border-t bg-background">
    {/* quick comment input */}
  </div>
</div>
```

### 3. `src/components/client/ClientFinancial.tsx`

Para a aba "entries" (Lançamentos):
- Mover `FinancialQuickNoteInput` para o FINAL do TabsContent
- Aplicar layout flex similar

```tsx
<TabsContent value="entries" className="mt-4 flex flex-col max-h-[600px]">
  {/* Lista scrollable */}
  <div className="flex-1 overflow-y-auto space-y-2 pr-2">
    {financialEntries.map(...)}
  </div>
  
  {/* Input fixo no fundo */}
  <div className="flex-shrink-0 pt-4 border-t bg-background">
    <FinancialQuickNoteInput ... />
  </div>
</TabsContent>
```

## Detalhes Técnicos

### Altura do Container

Usar `max-h-[600px]` como padrão, que:
- Permite cerca de 6-8 itens visíveis
- Funciona bem em telas de laptop (768px+)
- Pode ser ajustado com media queries se necessário

### Scroll Suave

Adicionar `scroll-smooth` para melhor UX ao navegar:
```css
.overflow-y-auto {
  scroll-behavior: smooth;
}
```

### Padding Right

Adicionar `pr-2` na área scrollable para evitar que a scrollbar sobreponha o conteúdo.

### Background do Input

Usar `bg-background` no container do input para garantir que ele se destaque do conteúdo scrollado.

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/client/Timeline.tsx` | Reestruturar layout com flex e área scrollable |
| `src/components/client/FinancialNotes.tsx` | Mover input para fundo + layout flex |
| `src/components/client/ClientFinancial.tsx` | Aba "entries": mover input para fundo + layout flex |

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Timeline com 50+ eventos | Rolar toda a página | Input sempre visível no fundo |
| Notas financeiras extensas | Rolar para comentar | Input sempre acessível |
| Lançamentos financeiros | Input no topo desaparece | Input fixo no fundo |
| Telas pequenas (laptop) | Mesmo problema | Área scrollable contida |
