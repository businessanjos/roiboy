

# Correção: Diálogo Fechando e Subtarefas Desaparecendo no Marketing

## Problemas Identificados

### Problema 1: Diálogo fecha após adicionar subtarefa
**Causa Raiz**: Os botões dentro do `SubtaskList.tsx` não têm `type="button"` explícito, e o componente está renderizado dentro de um `<form>` no `MarketingTaskDialog.tsx`. 

Em HTML, um `<button>` sem atributo `type` dentro de um `<form>` tem por padrão `type="submit"`, o que causa o envio do formulário principal.

**Código Problemático (SubtaskList.tsx linhas 167-180)**:
```tsx
<Button size="sm" className="h-8" onClick={handleAddSubtask}>
  <Check className="h-4 w-4" />
</Button>
<Button
  size="sm"
  variant="ghost"
  className="h-8"
  onClick={() => {
    setNewSubtaskTitle("");
    setIsAdding(false);
  }}
>
  <X className="h-4 w-4" />
</Button>
```

Quando o usuário clica no botão "check" para adicionar a subtarefa:
1. O `onClick` é executado (`handleAddSubtask`)
2. Mas o evento também propaga e dispara `onSubmit` do formulário pai
3. O `handleSubmit` do `MarketingTaskDialog` é executado
4. Ao final do submit, `onOpenChange(false)` fecha o diálogo

### Problema 2: Subtarefas desaparecendo

**Causa Raiz**: Após a inserção, o cache é invalidado com `invalidateQueries`, mas como o diálogo está fechando simultaneamente (devido ao problema 1), a query de subtarefas fica em um estado inconsistente. Quando o usuário reabre a tarefa, a query pode:
- Usar dados obsoletos do cache
- Não ter terminado de buscar os novos dados
- Ter o `taskId` momentaneamente `null` durante a transição

Além disso, há um possível problema de propagação de eventos nos botões de edição e exclusão de subtarefas (linhas 144-151):
```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
  onClick={() => deleteSubtask.mutate(subtask.id)}
>
```

---

## Solução Proposta

### Correção 1: Adicionar `type="button"` em todos os botões do SubtaskList

Isso impede que qualquer botão dentro da lista de subtarefas dispare o submit do formulário principal.

**Alterações em SubtaskList.tsx**:

| Linha | Antes | Depois |
|-------|-------|--------|
| 167 | `<Button size="sm" className="h-8" onClick={handleAddSubtask}>` | `<Button type="button" size="sm" className="h-8" onClick={handleAddSubtask}>` |
| 170-175 | `<Button size="sm" variant="ghost" className="h-8" onClick={...}>` | `<Button type="button" size="sm" variant="ghost" className="h-8" onClick={...}>` |
| 144-148 | `<Button variant="ghost" size="sm" ... onClick={...}>` | `<Button type="button" variant="ghost" size="sm" ... onClick={...}>` |
| 183-191 | `<Button variant="ghost" size="sm" ... onClick={() => setIsAdding(true)}>` | `<Button type="button" variant="ghost" size="sm" ... onClick={() => setIsAdding(true)}>` |

### Correção 2: Manter o input aberto para adicionar múltiplas subtarefas

Atualmente, após adicionar uma subtarefa, o estado `isAdding` é setado para `false` (linha 30), escondendo o campo de input. Para melhorar a experiência:

**Alterar comportamento (linha 29-30)**:
```tsx
// ANTES
setNewSubtaskTitle("");
setIsAdding(false);

// DEPOIS
setNewSubtaskTitle("");
// Manter isAdding = true para permitir adicionar mais subtarefas
// Só fechar com ESC ou clicando no X
```

### Correção 3: Adicionar `e.stopPropagation()` nos handlers

Para garantir que eventos de clique não propaguem para elementos pai, adicionar `stopPropagation` nos handlers críticos:

```tsx
const handleAddSubtask = async (e?: React.MouseEvent) => {
  e?.stopPropagation();
  e?.preventDefault();
  if (!newSubtaskTitle.trim() || !taskId) return;
  // ... resto do código
};
```

---

## Arquivos a Modificar

1. **`src/components/marketing/tasks/SubtaskList.tsx`**

---

## Resumo das Mudanças

| Localização | Mudança | Motivo |
|-------------|---------|--------|
| Linha 22-31 | Adicionar `e?.stopPropagation()` e `e?.preventDefault()` | Previne propagação de eventos |
| Linha 29-30 | Remover `setIsAdding(false)` | Permite adicionar múltiplas subtarefas sem fechar o input |
| Linha 144 | Adicionar `type="button"` | Previne submit do form |
| Linha 167 | Adicionar `type="button"` | Previne submit do form |
| Linha 170 | Adicionar `type="button"` | Previne submit do form |
| Linha 183 | Adicionar `type="button"` | Previne submit do form |

---

## Detalhes Técnicos

### Por que isso acontece?

O componente `SubtaskList` está sendo renderizado **dentro** do `<form>` do `MarketingTaskDialog`:

```tsx
// MarketingTaskDialog.tsx linha 172-296
<form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
  {/* ... outros campos ... */}
  <SubtaskList taskId={isEditing ? taskId : null} />
  {/* ... */}
</form>
```

Botões sem `type="button"` explícito são interpretados como `type="submit"` pelo navegador. Quando clicados, eles disparam o evento `submit` do formulário, mesmo que tenham um `onClick` handler.

### Diagrama do Fluxo Atual (COM BUG)

```text
[Usuário clica no botão ✓]
           │
           ▼
[onClick: handleAddSubtask()]
           │
           ├─────────────────────────────┐
           ▼                             ▼
[createSubtask.mutate]          [Evento submit propaga]
           │                             │
           ▼                             ▼
[invalidateQueries]              [handleSubmit() executa]
                                         │
                                         ▼
                                  [onOpenChange(false)]
                                         │
                                         ▼
                                 [Diálogo FECHA] ← BUG!
```

### Diagrama do Fluxo Corrigido

```text
[Usuário clica no botão ✓ (type="button")]
           │
           ▼
[onClick: handleAddSubtask()]
           │
           ▼
[e.stopPropagation() + e.preventDefault()]
           │
           ▼
[createSubtask.mutate]
           │
           ▼
[invalidateQueries → subtasks recarregadas]
           │
           ▼
[Input limpo, MANTÉM isAdding=true]
           │
           ▼
[Usuário pode adicionar mais subtarefas!] ← CORRIGIDO
```

