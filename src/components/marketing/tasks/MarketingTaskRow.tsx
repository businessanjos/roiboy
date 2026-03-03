import { format, isPast, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MarketingTask } from "@/hooks/useMarketingTasks";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface MarketingTaskRowProps {
  task: MarketingTask;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
}

const priorityConfig = {
  low: { label: "Baixa", className: "bg-slate-100 text-slate-700 hover:bg-slate-200" },
  medium: { label: "Média", className: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  high: { label: "Alta", className: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
};

const statusConfig = {
  pending: { label: "Pendente", className: "bg-slate-100 text-slate-700" },
  in_progress: { label: "Em andamento", className: "bg-blue-100 text-blue-700" },
  done: { label: "Concluído", className: "bg-emerald-100 text-emerald-700" },
};

export function MarketingTaskRow({ task, onEdit, onToggleComplete }: MarketingTaskRowProps) {
  const dueDate = task.due_date ? parseLocalDate(task.due_date) : null;
  
  const getDueDateDisplay = () => {
    if (!dueDate) return null;
    
    if (isToday(dueDate)) {
      return { text: "Hoje", className: "text-amber-600" };
    }
    if (isTomorrow(dueDate)) {
      return { text: "Amanhã", className: "text-blue-600" };
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
        task.is_completed && "opacity-60"
      )}
      onClick={onEdit}
    >
      {/* Drag Handle + Checkbox */}
      <div className="flex items-center gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 opacity-0 group-hover:opacity-100 cursor-grab" />
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={(checked) => {
            // Prevent row click
            onToggleComplete(!!checked);
          }}
          onClick={(e) => e.stopPropagation()}
          className="rounded-full"
        />
      </div>

      {/* Task Title */}
      <div className="min-w-0">
        <span
          className={cn(
            "text-sm truncate block",
            task.is_completed && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </span>
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
              {task.assignee.name?.split(" ")[0]}
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
