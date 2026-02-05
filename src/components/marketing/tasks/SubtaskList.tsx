import { useState } from "react";
import { Plus, X, Check, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useMarketingSubtasks, MarketingSubtask } from "@/hooks/useMarketingSubtasks";

interface SubtaskListProps {
  taskId: string | null;
}

export function SubtaskList({ taskId }: SubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { subtasks, isLoading, createSubtask, updateSubtask, deleteSubtask, toggleComplete } =
    useMarketingSubtasks(taskId);

  const handleAddSubtask = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!newSubtaskTitle.trim() || !taskId) return;

    await createSubtask.mutateAsync({
      task_id: taskId,
      title: newSubtaskTitle.trim(),
    });
    setNewSubtaskTitle("");
    // Keep isAdding=true to allow adding multiple subtasks
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddSubtask();
    } else if (e.key === "Escape") {
      setNewSubtaskTitle("");
      setIsAdding(false);
    }
  };

  const handleStartEditing = (subtask: MarketingSubtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      return;
    }

    await updateSubtask.mutateAsync({
      id: editingId,
      title: editingTitle.trim(),
    });
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const completedCount = subtasks.filter((s) => s.is_completed).length;

  if (!taskId) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">
          Subtarefas
        </div>
        <p className="text-sm text-muted-foreground italic">
          Salve a tarefa primeiro para adicionar subtarefas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Subtarefas</span>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{subtasks.length} concluídas
          </span>
        )}
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div
            key={subtask.id}
            className={cn(
              "flex items-center gap-2 py-1.5 px-2 rounded group hover:bg-muted/50 transition-colors",
              subtask.is_completed && "opacity-60"
            )}
          >
            <GripVertical className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
            
            <Checkbox
              checked={subtask.is_completed}
              onCheckedChange={(checked) =>
                toggleComplete.mutate({ id: subtask.id, isCompleted: !!checked })
              }
            />

            {editingId === subtask.id ? (
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleEditKeyDown}
                className="h-7 text-sm flex-1"
                autoFocus
              />
            ) : (
              <span
                className={cn(
                  "text-sm flex-1 cursor-pointer",
                  subtask.is_completed && "line-through"
                )}
                onClick={() => handleStartEditing(subtask)}
              >
                {subtask.title}
              </span>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                deleteSubtask.mutate(subtask.id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new subtask */}
      {isAdding ? (
        <div className="flex items-center gap-2">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Título da subtarefa..."
            className="h-8 text-sm"
            autoFocus
          />
          <Button type="button" size="sm" className="h-8" onClick={handleAddSubtask}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            onClick={(e) => {
              e.stopPropagation();
              setNewSubtaskTitle("");
              setIsAdding(false);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setIsAdding(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar subtarefa
        </Button>
      )}
    </div>
  );
}
