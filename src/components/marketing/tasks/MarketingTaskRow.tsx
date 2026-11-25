import { format, isPast, isToday, isTomorrow, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import { cn } from "@/lib/utils";
import { GripVertical, AlertCircle } from "lucide-react";
import { readTaskDetails } from "@/lib/marketing/taskDetails";
import { TaskPeopleAndLabels } from "./TaskPeopleAndLabels";
import { TaskCardCover } from "./TaskCover";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { taskPersonPresentation } from "@/lib/marketing/taskPresentation";
import type { TaskSelectionProps } from "./TaskSelection";

interface MarketingTaskRowProps extends TaskSelectionProps {
  task: MarketingTask;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
}

const priorityConfig = {
  low: { label: "Baixa", className: "bg-muted text-foreground hover:bg-muted" },
  medium: { label: "Média", className: "bg-warning-soft text-warning-strong hover:bg-warning-soft" },
  high: { label: "Alta", className: "bg-danger-soft text-danger-strong hover:bg-danger-soft" },
};

const statusConfig = {
  pending: { label: "Pendente", className: "bg-muted text-foreground" },
  in_progress: { label: "Em andamento", className: "bg-info-soft text-info-strong" },
  done: { label: "Concluído", className: "bg-success-soft text-success-strong" },
};

function isTaskOverdue(task: MarketingTask): boolean {
  if (!task.due_date || task.is_completed || task.status === "done") return false;
  const due = startOfDay(parseISO(task.due_date));
  return isPast(due) && !isToday(due);
}

export function MarketingTaskRow({ task, onEdit, onToggleComplete, selectionMode = false, selectedTaskIds, onSelectTask, selectionDisabled = false }: MarketingTaskRowProps) {
  const { currentUser } = useCurrentUser();
  const dueDate = task.due_date ? parseLocalDate(task.due_date) : null;
  const details = readTaskDetails(task);
  
  const getDueDateDisplay = () => {
    if (!dueDate) return null;
    
    if (isToday(dueDate)) {
      return { text: "Hoje", className: "text-warning" };
    }
    if (isTomorrow(dueDate)) {
      return { text: "Amanhã", className: "text-info" };
    }
    if (isPast(dueDate) && !task.is_completed) {
      return { text: format(dueDate, "d MMM", { locale: ptBR }), className: "text-destructive" };
    }
    return { text: format(dueDate, "d MMM", { locale: ptBR }), className: "text-muted-foreground" };
  };

  const dueDateDisplay = getDueDateDisplay();

  return (
    <div
      className={cn(
        "grid grid-cols-[auto,1fr,140px,120px,100px,100px] gap-2 px-4 py-2 items-center hover:bg-muted/30 transition-colors cursor-pointer group border-b last:border-b-0",
        task.is_completed && "opacity-60",
        isTaskOverdue(task) && "bg-destructive/5 hover:bg-destructive/10",
        selectionMode && selectedTaskIds?.has(task.id) && "bg-primary/10"
      )}
      onClick={() => { if (selectionDisabled) return; if (selectionMode) onSelectTask?.(task.id); else onEdit(); }}
    >
      {/* Drag Handle + Checkbox */}
      <div className="flex items-center gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
        <Checkbox
          checked={selectionMode ? selectedTaskIds?.has(task.id) ?? false : task.is_completed}
          disabled={selectionDisabled}
          aria-label={selectionMode ? `Selecionar tarefa ${task.title}` : task.is_completed ? "Reabrir tarefa" : "Concluir tarefa"}
          onCheckedChange={(checked) => {
            // Prevent row click
            if (selectionMode) onSelectTask?.(task.id); else onToggleComplete(!!checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className={selectionMode ? undefined : "rounded-full"}
        />
      </div>

      {/* Task Title */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
        <TaskCardCover task={task} compact />
        <span
          className={cn(
            "text-sm truncate block",
            task.is_completed && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>
        {isTaskOverdue(task) && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1 shrink-0">
            <AlertCircle className="h-3 w-3" />
            Atrasada
          </Badge>
        )}
        </div>
        <TaskPeopleAndLabels task={task} showAssignee={false} />
      </div>

      {/* Assignee */}
      <div className="flex items-center gap-2">
        {task.assignee ? (
          <>
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assignee.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {task.assignee.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground truncate max-w-[80px]">
              {taskPersonPresentation(task.assignee_id, task.assignee.name, currentUser?.id).name}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Due Date */}
      <div>
        {dueDateDisplay ? (
          <span className={cn("text-sm", dueDateDisplay.className)}>
            {dueDateDisplay.text}
            {details.dueTime && <span className="block text-xs">{details.dueTime}</span>}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Status */}
      <div>
        <Badge variant="secondary" className={cn("text-xs", statusConfig[task.status].className)}>
          {statusConfig[task.status].label}
        </Badge>
      </div>

      {/* Priority */}
      <div>
        <Badge variant="secondary" className={cn("text-xs", priorityConfig[task.priority].className)}>
          {priorityConfig[task.priority].label}
        </Badge>
      </div>
    </div>
  );
}
