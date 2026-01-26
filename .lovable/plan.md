
# Plano: Correção Final da Visualização - Scroll Visível e Informações Completas

## Problemas Identificados nas Imagens

| Problema | Causa | Evidência |
|----------|-------|-----------|
| Scroll não aparece na primeira página | O `ScrollArea` do Radix precisa que o `Viewport` tenha `overflow-y-auto` e o container precisa ter altura explícita | Campos abaixo de "Profissão" não são acessíveis |
| Telefone truncado na segunda página | Grid de 2 colunas está forçando o telefone a ficar cortado | "+5543..." em vez do número completo "(43) 99697-9418" |

---

## Solução Proposta

### Correção 1: Usar overflow nativo em vez de ScrollArea

O `ScrollArea` do Radix tem problemas conhecidos com altura calculada em flex containers. A solução mais confiável é usar `overflow-y-auto` nativo:

**Mudança no container de conteúdo:**

```typescript
{/* Content */}
<div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
  <div className="space-y-6">
    {/* conteúdo... */}
  </div>
</div>
```

Benefícios:
- `overflow-y-auto` nativo funciona 100% com flex containers
- A barra de scroll aparece automaticamente quando necessário
- `min-h-0` permite o container encolher e criar scroll

### Correção 2: Layout de Informações do Cliente em Coluna Única

Para garantir que o telefone nunca seja truncado, mudar de grid para layout vertical:

```typescript
<div className="space-y-3">
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground flex items-center gap-1">
      <User className="h-3 w-3" /> Nome
    </Label>
    <p className="font-medium break-words">
      {selectedResponse.clients?.full_name || selectedResponse.client_name || "—"}
    </p>
  </div>
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground flex items-center gap-1">
      <Phone className="h-3 w-3" /> Telefone
    </Label>
    <p className="font-medium">
      {selectedResponse.clients?.phone_e164 || selectedResponse.client_phone || "—"}
    </p>
  </div>
</div>
```

Cada campo fica em sua própria linha, eliminando qualquer possibilidade de truncamento horizontal.

---

## Estrutura Final do Dialog

```text
┌────────────────────────────────────────────────────┐
│ DialogContent (max-h-[85vh] !flex !flex-col)       │
│ ┌────────────────────────────────────────────────┐ │
│ │ Header (flex-shrink-0)                         │ │
│ │ Avatar + Nome + Data | Navegação               │ │
│ └────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────┐ │
│ │ Content (flex-1 min-h-0 overflow-y-auto)       │ │
│ │ ┌──────────────────────────────────────────┐ ▲ │ │
│ │ │ Informações do Cliente (coluna única)    │ █ │ │
│ │ │ - Nome (linha completa)                  │ █ │ │
│ │ │ - Telefone (linha completa)              │ █ │ │
│ │ │ - Ver perfil/Vincular                    │ █ │ │
│ │ ├──────────────────────────────────────────┤ █ │ │
│ │ │ Respostas do Formulário                  │ █ │ │
│ │ │ - Campo 1                                │ █ │ │
│ │ │ - Campo 2                                │ █ │ │
│ │ │ - Campo N...                             │ ▼ │ │
│ │ └──────────────────────────────────────────┘   │ │
│ └────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────┐ │
│ │ Footer (flex-shrink-0)                         │ │
│ │ Botão Fechar                                   │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/forms/FormResponseViewer.tsx` | Substituir ScrollArea por overflow-y-auto nativo e mudar grid para layout vertical |

---

## Impacto Esperado

1. **Barra de scroll nativa** aparecerá quando o conteúdo exceder a altura disponível
2. **Nome e telefone** serão exibidos por completo, sem truncamento
3. **Todos os campos** de resposta serão acessíveis via scroll
4. **Header e Footer** permanecem fixos enquanto o conteúdo rola

## Detalhes Técnicos

A razão do ScrollArea do Radix não funcionar corretamente neste contexto:
- O Viewport interno usa `h-full w-full` mas precisa de uma altura explícita do container pai
- Com `flex-1` em flex containers, a altura calculada pode não ser passada corretamente
- `overflow-y-auto` nativo do CSS é mais confiável neste cenário específico
