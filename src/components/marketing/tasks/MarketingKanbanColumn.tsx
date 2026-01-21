import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarketingKanbanCard } from "./MarketingKanbanCard";
import { MarketingTask, MarketingTaskStatus } from "@/hooks/useMarketingTasks";

interface MarketingKanbanColumnProps {
  status: MarketingTaskStatus;
  title: string;
  tasks: MarketingTask[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onAddTask: () => void;
  subtaskCounts: Record<string, { total: number; completed: number }>;
}

const statusColors: Record<MarketingTaskStatus, string> = {
  pending: "border-t-slate-400",
  in_progress: "border-t-blue-500",
  done: "border-t-green-500",
};

export function MarketingKanbanColumn({
  status,
  title,
  tasks,
  onEditTask,
  onToggleComplete,
  onAddTask,
  subtaskCounts,
}: MarketingKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-[300px] max-w-[350px] bg-muted/30 rounded-lg border border-t-4",
        statusColors[status],
        isOver && "bg-muted/50 ring-2 ring-primary/20"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onAddTask}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <MarketingKanbanCard
              key={task.id}
              task={task}
              onEdit={() => onEditTask(task.id)}
              onToggleComplete={(completed) => onToggleComplete(task.id, completed)}
              subtaskInfo={subtaskCounts[task.id]}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma tarefa
          </div>
        )}
      </div>
    </div>
  );
}
