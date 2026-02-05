

# Correção: Diálogo Fechando ao Criar Subtarefas

## Problema Identificado

Os handlers de teclado `handleKeyDown` (linha 35) e `handleEditKeyDown` (linha 62) não estão chamando `e.preventDefault()` e `e.stopPropagation()` quando a tecla **Enter** é pressionada.

Isso faz com que o evento de Enter se propague até o `<form>` pai no `MarketingTaskDialog.tsx`, disparando o `handleSubmit` que fecha o diálogo.

---

## Solução

**Arquivo**: `src/components/marketing/tasks/SubtaskList.tsx`

### Mudança 1: handleKeyDown (linhas 35-42)

```tsx
// ANTES:
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    handleAddSubtask();
  } else if (e.key === "Escape") {
    setNewSubtaskTitle("");
    setIsAdding(false);
  }
};

// DEPOIS:
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    handleAddSubtask();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    setNewSubtaskTitle("");
    setIsAdding(false);
  }
};
```

### Mudança 2: handleEditKeyDown (linhas 62-68)

```tsx
// ANTES:
const handleEditKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    handleSaveEdit();
  } else if (e.key === "Escape") {
    setEditingId(null);
  }
};

// DEPOIS:
const handleEditKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    handleSaveEdit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(null);
  }
};
```

---

## Resumo

| Local | Mudança |
|-------|---------|
| `handleKeyDown` | Adicionar `e.preventDefault()` e `e.stopPropagation()` |
| `handleEditKeyDown` | Adicionar `e.preventDefault()` e `e.stopPropagation()` |

---

## Resultado Esperado

- Pressionar **Enter** no input de nova subtarefa: cria a subtarefa, mantém o diálogo aberto
- Pressionar **Enter** no input de edição: salva a subtarefa, mantém o diálogo aberto
- Pressionar **Escape**: cancela a ação sem fechar o diálogo principal

