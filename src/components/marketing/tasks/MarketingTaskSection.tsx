import { useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketingTaskRow } from "./MarketingTaskRow";
import { useMarketingTaskSections, MarketingTaskSection as SectionType } from "@/hooks/useMarketingTaskSections";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface MarketingTaskSectionProps {
  section: SectionType;
  tasks: MarketingTask[];
  onAddTask: () => void;
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
}

export function MarketingTaskSection({
  section,
  tasks,
  onAddTask,
  onEditTask,
  onToggleComplete,
}: MarketingTaskSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(section.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { updateSection, deleteSection, toggleCollapse } = useMarketingTaskSections();

  const handleToggleCollapse = () => {
    toggleCollapse.mutate({ id: section.id, isCollapsed: !section.is_collapsed });
  };

  const handleSaveName = async () => {
    if (editedName.trim() && editedName !== section.name) {
      await updateSection.mutateAsync({ id: section.id, name: editedName.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setEditedName(section.name);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    await deleteSection.mutateAsync(section.id);
    setShowDeleteDialog(false);
  };

  const completedCount = tasks.filter((t) => t.is_completed).length;

  return (
    <div className="border-b last:border-b-0">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 hover:bg-muted/40 transition-colors group">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleToggleCollapse}
        >
          {section.is_collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {isEditing ? (
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            className="h-7 text-sm font-semibold max-w-xs"
            autoFocus
          />
        ) : (
          <span
            className="font-semibold text-sm cursor-pointer hover:text-primary"
            onClick={() => setIsEditing(true)}
          >
            {section.name}
          </span>
        )}

        <span className="text-xs text-muted-foreground">
          ({completedCount}/{tasks.length})
        </span>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir seção
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tasks */}
      {!section.is_collapsed && (
        <>
          {tasks.map((task) => (
            <MarketingTaskRow
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task.id)}
              onToggleComplete={(completed) => onToggleComplete(task.id, completed)}
            />
          ))}

          {/* Add Task Row */}
          <div
            className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/20 cursor-pointer transition-colors"
            onClick={onAddTask}
          >
            <div className="w-6" />
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add task...</span>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir seção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir a seção "{section.name}". As tarefas dentro
              dela serão movidas para sem seção.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
