import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, ListMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MarketingKanbanCard } from "./MarketingKanbanCard";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import { MarketingTaskColumn } from "@/hooks/useMarketingTaskColumns";
import { taskBoardItems, type TaskSeparator } from "@/lib/marketing/taskPresentation";
import { TaskSeparatorItem } from "./TaskSeparator";

interface MarketingKanbanColumnProps {
  fullHeight?: boolean;
  column: MarketingTaskColumn;
  tasks: MarketingTask[];
  onEditTask: (taskId: string) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  onAddTask: () => void;
  subtaskCounts: Record<string, { total: number; completed: number }>;
  separators: TaskSeparator[];
  onAddSeparator: () => void;
  onEditSeparator: (separator: TaskSeparator) => void;
}

export function MarketingKanbanColumn({
  fullHeight = false,
  column,
  tasks,
  onEditTask,
  onToggleComplete,
  onAddTask,
  subtaskCounts,
  separators,
  onAddSeparator,
  onEditSeparator,
}: MarketingKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const items = taskBoardItems(tasks, separators);

  return (
    <div
      ref={setNodeRef}
      style={{ borderTopColor: column.color }}
      className={cn(
        "flex flex-col min-w-[300px] max-w-[350px] bg-muted/30 rounded-lg border border-t-4",
        fullHeight && "min-h-0 shrink-0",
        isOver && "bg-muted/50 ring-2 ring-primary/20"
      )}
    >
      <div className="flex min-h-[60px] shrink-0 items-center justify-between gap-3 rounded-t-md border-b border-border/70 bg-background/60 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <h3 className="min-w-0 break-words text-[15px] font-bold leading-5 text-foreground">{column.title}</h3>
          <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground" aria-label={`${tasks.length} tarefas`}>
            {tasks.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Adicionar separador em ${column.title}`} title="Adicionar separador" onClick={onAddSeparator}><ListMinus className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border/70 bg-background/80 text-muted-foreground shadow-none hover:text-foreground" aria-label={`Adicionar tarefa em ${column.title}`} title="Adicionar tarefa" onClick={onAddTask}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn("flex-1 p-2 space-y-2 overflow-y-auto", fullHeight ? "min-h-0" : "max-h-[calc(100vh-280px)]")}>
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => item.kind === "separator" ? <TaskSeparatorItem key={item.id} separator={item.separator} onEdit={() => onEditSeparator(item.separator)} /> : (
            <MarketingKanbanCard
              key={item.id}
              task={item.task}
              onEdit={() => onEditTask(item.task.id)}
              onToggleComplete={(completed) => onToggleComplete(item.task.id, completed)}
              subtaskInfo={subtaskCounts[item.task.id]}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma tarefa</div>
        )}
      </div>
    </div>
  );
}
