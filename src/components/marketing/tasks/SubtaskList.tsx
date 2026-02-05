import { useState } from "react";
import { Plus, X, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMarketingSubtasks } from "@/hooks/useMarketingSubtasks";
import { SortableSubtaskItem } from "./SortableSubtaskItem";

interface SubtaskListProps {
  taskId: string | null;
}

export function SubtaskList({ taskId }: SubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { subtasks, isLoading, createSubtask, updateSubtask, deleteSubtask, toggleComplete, reorderSubtasks } =
    useMarketingSubtasks(taskId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(subtasks, oldIndex, newIndex);
      const updates = reordered.map((s, index) => ({
        id: s.id,
        display_order: index,
      }));
      reorderSubtasks.mutate(updates);
    }
  };

  const handleAddSubtask = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!newSubtaskTitle.trim() || !taskId) return;

    await createSubtask.mutateAsync({
      task_id: taskId,
      title: newSubtaskTitle.trim(),
    });
    setNewSubtaskTitle("");
  };

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

      {/* Subtask list with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {subtasks.map((subtask) => (
              <SortableSubtaskItem
                key={subtask.id}
                subtask={subtask}
                isEditing={editingId === subtask.id}
                editingTitle={editingTitle}
                onStartEditing={() => {
                  setEditingId(subtask.id);
                  setEditingTitle(subtask.title);
                }}
                onEditingTitleChange={setEditingTitle}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onToggleComplete={(checked) =>
                  toggleComplete.mutate({ id: subtask.id, isCompleted: checked })
                }
                onDelete={() => deleteSubtask.mutate(subtask.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
