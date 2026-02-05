import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MarketingSubtask } from "@/hooks/useMarketingSubtasks";

interface SortableSubtaskItemProps {
  subtask: MarketingSubtask;
  isEditing: boolean;
  editingTitle: string;
  onStartEditing: () => void;
  onEditingTitleChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleComplete: (checked: boolean) => void;
  onDelete: () => void;
}

export function SortableSubtaskItem({
  subtask,
  isEditing,
  editingTitle,
  onStartEditing,
  onEditingTitleChange,
  onSaveEdit,
  onCancelEdit,
  onToggleComplete,
  onDelete,
}: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onSaveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancelEdit();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded group hover:bg-muted/50 transition-colors",
        subtask.is_completed && "opacity-60",
        isDragging && "opacity-50 bg-muted shadow-md"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100" />
      </div>

      <Checkbox
        checked={subtask.is_completed}
        onCheckedChange={(checked) => onToggleComplete(!!checked)}
      />

      {isEditing ? (
        <Input
          value={editingTitle}
          onChange={(e) => onEditingTitleChange(e.target.value)}
          onBlur={onSaveEdit}
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
          onClick={onStartEditing}
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
          onDelete();
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
