
# Plano: Correção Definitiva da Visualização de Respostas do Formulário

## Problema Identificado

Após análise detalhada da imagem e código, identifiquei os seguintes problemas:

| Problema | Causa | Evidência |
|----------|-------|-----------|
| Telefone truncado (+5...) | Grid de 2 colunas sem overflow handling | Imagem mostra "+5..." em vez do número completo |
| Campos cortados na parte inferior | ScrollArea não recebe altura calculável | "Rua" aparece cortada na imagem |
| Conteúdo não rolável | DialogContent usa `grid` (Radix default) mas código tenta usar `flex-1` | Layout base do dialog conflita com flex layout |

**Causa raiz:** O `DialogContent` do Radix UI usa `display: grid` por padrão, mas o código atual tenta usar `flex flex-col` com `flex-1`. O `flex-1` não funciona corretamente dentro de um container grid, fazendo com que o `ScrollArea` não tenha altura calculável e o scroll não funcione.

---

## Solução Proposta

### Correção 1: Reestruturar Layout do Dialog para Flex Funcional

**Arquivo:** `src/components/forms/FormResponseViewer.tsx`

O DialogContent precisa forçar `display: flex` para que o layout funcione:

```typescript
<DialogContent className="max-w-3xl max-h-[85vh] !flex !flex-col overflow-hidden p-0">
```

A classe `!flex` com `!important` sobrescreve o `grid` padrão do Radix.

### Correção 2: Dar Altura Explícita ao ScrollArea

O ScrollArea precisa de um container com altura limitada e calculável:

```typescript
{/* Content - área com scroll */}
<div className="flex-1 min-h-0 overflow-hidden">
  <ScrollArea className="h-full">
    <div className="px-6 py-4 space-y-6">
      {/* conteúdo das respostas */}
    </div>
  </ScrollArea>
</div>
```

O `min-h-0` é crítico em flex containers para permitir que o item encolha abaixo de seu conteúdo natural.

### Correção 3: Corrigir Grid de Informações do Cliente

O grid das informações está cortando o telefone. Mudar para layout responsivo:

```typescript
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div className="space-y-1 min-w-0">
    <Label className="text-xs text-muted-foreground flex items-center gap-1">
      <User className="h-3 w-3" /> Nome
    </Label>
    <p className="font-medium break-words">
      {selectedResponse.clients?.full_name || selectedResponse.client_name || "—"}
    </p>
  </div>
  <div className="space-y-1 min-w-0">
    <Label className="text-xs text-muted-foreground flex items-center gap-1">
      <Phone className="h-3 w-3" /> Telefone
    </Label>
    <p className="font-medium break-all">
      {selectedResponse.clients?.phone_e164 || selectedResponse.client_phone || "—"}
    </p>
  </div>
</div>
```

Alterações:
- `grid-cols-1 sm:grid-cols-2` - responsivo para mobile
- `min-w-0` - permite texto encolher em flex/grid
- `break-words` e `break-all` - força quebra de texto

### Correção 4: Garantir Overflow no Container de Respostas

```typescript
<div className="divide-y rounded-lg border bg-card overflow-hidden">
  {orderedFields.map((field) => {
    const value = selectedResponse.responses?.[field.id];

    return (
      <div key={field.id} className="flex flex-col gap-2 p-4 overflow-hidden">
        <div className="min-w-0">
          <Label className="text-sm font-medium text-foreground break-words">
            {field.name}
            {field.is_required && <span className="text-destructive ml-1">*</span>}
          </Label>
        </div>
        <div className="text-sm break-words min-w-0 overflow-hidden">
          {renderValue(field, value)}
        </div>
      </div>
    );
  })}
</div>
```

---

## Estrutura Final do Dialog

```text
┌─────────────────────────────────────────────────┐
│ DialogContent                                   │
│ (!flex !flex-col max-h-[85vh] overflow-hidden)  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Header (flex-shrink-0)                      │ │
│ │ - Avatar + Nome + Data                      │ │
│ │ - Navegação (< 2 de 3 >)                    │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Content Container (flex-1 min-h-0)          │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ ScrollArea (h-full) ← SCROLL FUNCIONA   │ │ │
│ │ │ - Info Cliente                          │ │ │
│ │ │ - Respostas do Formulário               │ │ │
│ │ │   - Campo 1                             │ │ │
│ │ │   - Campo 2                             │ │ │
│ │ │   - Campo N...                          │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ Footer (flex-shrink-0)                      │ │
│ │ - Botão Fechar                              │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/forms/FormResponseViewer.tsx` | Reestruturar layout do modal com flex funcional, altura explícita no ScrollArea, e overflow handling adequado |

---

## Impacto Esperado

1. Scroll funcional na área de conteúdo quando houver muitos campos
2. Telefone e textos longos serão exibidos por completo com quebra de linha
3. Todos os campos de resposta serão visíveis e acessíveis
4. Layout responsivo funciona em diferentes tamanhos de tela
5. Header e Footer fixos enquanto o conteúdo rola
