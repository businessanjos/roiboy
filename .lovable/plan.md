

# Diagnóstico Completo: Janela de Tarefa Fechando ao Adicionar Subtarefa

## Resumo do Problema

Alguns usuários do setor de Marketing relatam que a janela de detalhes da tarefa fecha automaticamente após adicionar uma subtarefa, forçando-os a reabrir a tarefa para adicionar mais subtarefas. O problema não é reproduzido em todos os ambientes.

---

## Análise Técnica

### Fluxo de Código Atual

```text
MarketingTasksTab.tsx
    └── MarketingTaskDialog.tsx (Dialog principal)
            └── SubtaskList.tsx (Lista de subtarefas)
                    └── handleAddSubtask() → createSubtask.mutateAsync()
                            └── onSuccess: invalidateQueries(["marketing-subtasks"])
```

### Código Suspeito Identificado

#### 1. Componente `SubtaskList.tsx`

O código atual tem proteções contra propagação de eventos:

```typescript
const handleAddSubtask = async (e?: React.MouseEvent) => {
  e?.stopPropagation();
  e?.preventDefault();
  // ...
  await createSubtask.mutateAsync({ ... });
  setNewSubtaskTitle("");
};

const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    handleAddSubtask();
  }
  // ...
};
```

**Problema potencial**: Quando o usuário pressiona Enter, a função `handleKeyDown` para a propagação do evento, mas o `handleAddSubtask()` é chamado **sem o evento**. Isso significa que qualquer efeito colateral que dependa do evento não está sendo tratado.

#### 2. Botão de Adicionar no `SubtaskList.tsx`

```typescript
<Button type="button" size="sm" className="h-8" onClick={handleAddSubtask}>
  <Check className="h-4 w-4" />
</Button>
```

O `type="button"` está correto, mas o evento de clique não é passado diretamente para `handleAddSubtask` com a assinatura correta.

---

## Causas Raiz Identificadas

### Causa 1: Form Submit Bubbling (MAIS PROVÁVEL)

O `SubtaskList` está dentro de um `<form>` no `MarketingTaskDialog`:

```typescript
<form onSubmit={handleSubmit} className="...">
  {/* ... */}
  <SubtaskList taskId={isEditing ? taskId : null} />
  {/* ... */}
</form>
```

Quando o usuário pressiona **Enter** no input de nova subtarefa, mesmo com `e.preventDefault()` e `e.stopPropagation()`, em alguns navegadores ou condições de rede lenta, o evento pode "vazar" e disparar o `handleSubmit` do formulário pai, que:

1. Atualiza a tarefa principal
2. Fecha o dialog após sucesso: `onOpenChange(false)`

### Causa 2: Race Condition com Query Invalidation

O `createSubtask` invalida a query de subtarefas:

```typescript
onSuccess: (_, variables) => {
  queryClient.invalidateQueries({ queryKey: ["marketing-subtasks", variables.task_id] });
}
```

Se houver outra mutation acontecendo simultaneamente (como atualização automática da tarefa), pode haver uma condição de corrida que afete o estado do dialog.

### Causa 3: Re-render Forçado pelo Parent

O `MarketingTasksTab` tem um estado que controla o dialog:

```typescript
const [isDialogOpen, setIsDialogOpen] = useState(false);
```

Se a invalidação de queries causar um re-render que afete este estado, o dialog pode fechar.

---

## Por Que Funciona para Alguns Usuários?

1. **Velocidade de conexão**: Em conexões mais rápidas, a mutation completa antes que o evento de teclado possa propagar
2. **Método de adicionar**: Usuários que clicam no botão vs. pressionam Enter podem ter comportamentos diferentes
3. **Versão do navegador**: Diferentes implementações de propagação de eventos

---

## Solução Proposta

### Mudança 1: Isolar o Input de Subtarefa do Form Principal

Garantir que eventos de teclado não possam propagar para o form pai de forma alguma:

```typescript
// SubtaskList.tsx - handleKeyDown
const handleKeyDown = (e: React.KeyboardEvent) => {
  // Parar TODOS os eventos para evitar qualquer bubbling
  if (e.key === "Enter" || e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.key === "Enter" && newSubtaskTitle.trim()) {
      handleAddSubtask();
    } else if (e.key === "Escape") {
      setNewSubtaskTitle("");
      setIsAdding(false);
    }
    return; // Retorno explícito
  }
};
```

### Mudança 2: Adicionar onKeyDown ao Container

Adicionar um handler de eventos no container do input para capturar qualquer evento que escape:

```typescript
<div 
  className="flex items-center gap-2"
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.stopPropagation();
    }
  }}
>
  <Input ... onKeyDown={handleKeyDown} />
  ...
</div>
```

### Mudança 3: Usar Form Tag Local

Envolver o input de subtarefa em seu próprio form isolado com `onSubmit` que previne propagação:

```typescript
<form 
  onSubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    handleAddSubtask();
  }}
  className="flex items-center gap-2"
>
  <Input
    value={newSubtaskTitle}
    onChange={(e) => setNewSubtaskTitle(e.target.value)}
    placeholder="Título da subtarefa..."
    className="h-8 text-sm"
    autoFocus
  />
  <Button type="submit" size="sm" className="h-8">
    <Check className="h-4 w-4" />
  </Button>
  <Button type="button" ... onClick={...}>
    <X className="h-4 w-4" />
  </Button>
</form>
```

### Mudança 4: Mover SubtaskList para Fora do Form

Mover o `SubtaskList` e outros componentes não-formulário para fora do `<form>` tag no `MarketingTaskDialog`:

```typescript
// MarketingTaskDialog.tsx
<DialogContent>
  <form onSubmit={handleSubmit}>
    {/* Campos do formulário principal */}
    {/* ... Title, Description, Selects, etc ... */}
    
    {/* Botões de ação do form */}
    <div className="flex items-center justify-between pt-4">
      {/* Delete, Cancel, Submit buttons */}
    </div>
  </form>
  
  {/* Subtarefas FORA do form */}
  <Separator />
  <SubtaskList taskId={isEditing ? taskId : null} />
  
  {/* Media também FORA do form */}
  <Separator />
  <MarketingTaskMediaUpload ... />
</DialogContent>
```

---

## Plano de Implementação

| Arquivo | Mudança |
|---------|---------|
| `src/components/marketing/tasks/SubtaskList.tsx` | Envolver input em form próprio com isolamento de eventos |
| `src/components/marketing/tasks/MarketingTaskDialog.tsx` | Reorganizar estrutura para separar SubtaskList do form principal |

---

## Arquivos a Modificar

### `SubtaskList.tsx`
- Envolver área de input em `<form>` local
- Adicionar handlers de evento no container
- Garantir retorno explícito após stopPropagation

### `MarketingTaskDialog.tsx`
- Mover `<SubtaskList>` e `<MarketingTaskMediaUpload>` para fora do `<form>` principal
- Manter apenas campos editáveis da tarefa dentro do form

---

## Resultado Esperado

- Adicionar subtarefas não fechará mais o dialog
- Usuários poderão adicionar múltiplas subtarefas consecutivamente
- Funcionalidade consistente em todos os navegadores e velocidades de conexão

