

# Plano: Adicionar Botão de Excluir Tarefa no TaskDialog

## Objetivo

Adicionar um botão discreto com ícone de lixeira no **canto inferior esquerdo** do dialog de edição de tarefa. O botão só aparece em modo de edição (quando já existe uma tarefa) e abre uma janela de confirmação antes de excluir.

## Referência Visual

Baseado na imagem fornecida, o layout atual dos botões é:

```text
┌──────────────────────────────────────────────────────┐
│                                                      │
│              (... campos do formulário ...)          │
│                                                      │
│                              [Cancelar]  [Salvar]    │
└──────────────────────────────────────────────────────┘
```

O layout desejado será:

```text
┌──────────────────────────────────────────────────────┐
│                                                      │
│              (... campos do formulário ...)          │
│                                                      │
│  [🗑]                         [Cancelar]  [Salvar]   │
└──────────────────────────────────────────────────────┘
```

## Modificações Técnicas

### Arquivo: `src/components/tasks/TaskDialog.tsx`

#### 1. Adicionar imports necessários

Adicionar o ícone `Trash2` do Lucide e os componentes de AlertDialog:

```typescript
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

#### 2. Adicionar estado para controlar o dialog de confirmação

```typescript
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [deleting, setDeleting] = useState(false);
```

#### 3. Adicionar função de exclusão

```typescript
const handleDelete = async () => {
  if (!task?.id) return;
  
  setDeleting(true);
  try {
    const { error } = await supabase
      .from("internal_tasks")
      .delete()
      .eq("id", task.id);
      
    if (error) throw error;
    
    logAudit({
      action: "delete",
      entityType: "task",
      entityId: task.id,
      entityName: task.title,
    });
    
    toast.success("Tarefa excluída!");
    setDeleteDialogOpen(false);
    onOpenChange(false);
    onSuccess();
  } catch (error: any) {
    console.error("Error deleting task:", error);
    toast.error(error.message || "Erro ao excluir tarefa");
  } finally {
    setDeleting(false);
  }
};
```

#### 4. Modificar a área dos botões (linha 675)

Alterar de:
```tsx
<div className="flex justify-end gap-2 pt-4">
```

Para:
```tsx
<div className="flex items-center justify-between pt-4">
  {/* Botão de excluir - só aparece em modo edição */}
  {task ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-destructive"
      onClick={() => setDeleteDialogOpen(true)}
      title="Excluir tarefa"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  ) : (
    <div /> // Espaçador para manter o layout
  )}
  
  <div className="flex gap-2">
    <Button variant="outline" onClick={() => onOpenChange(false)}>
      Cancelar
    </Button>
    <Button onClick={handleSubmit} disabled={submitting}>
      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {task ? "Salvar" : "Criar Tarefa"}
    </Button>
  </div>
</div>
```

#### 5. Adicionar AlertDialog de confirmação

Inserir após o `MeetingConfigDialog` (antes do fechamento do `</Dialog>`):

```tsx
{/* Delete Confirmation Dialog */}
<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta ação não pode ser desfeita. A tarefa "{task?.title}" será permanentemente excluída.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleDelete}
        disabled={deleting}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Excluir
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Resultado Visual

| Estado | Comportamento |
|--------|---------------|
| **Nova tarefa** | Botão de lixeira **não aparece** (não faz sentido excluir algo que ainda não existe) |
| **Edição de tarefa** | Botão de lixeira aparece discreto no canto inferior esquerdo |
| **Ao clicar** | Abre AlertDialog com confirmação "Excluir tarefa?" |
| **Ao confirmar** | Exclui a tarefa, fecha o dialog, exibe toast de sucesso |

## Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/tasks/TaskDialog.tsx` | Adicionar imports, estados, função de delete, botão e AlertDialog |

## Estimativa

- **Complexidade**: Baixa
- **Risco**: Baixo (funcionalidade isolada)
- **Consistência**: Segue o mesmo padrão usado em `MarketingTaskDialog.tsx` e `ClientTasks.tsx`

