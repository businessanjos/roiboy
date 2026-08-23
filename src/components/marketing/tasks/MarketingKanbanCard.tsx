import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isToday, isTomorrow, isPast, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateUtils";
import { CalendarIcon, GripVertical, CheckCircle2, Circle, ListTodo, Paperclip, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarketingTask } from "@/hooks/useMarketingTasks";

function isTaskOverdue(task: MarketingTask): boolean {
  if (!task.due_date || task.is_completed || task.status === "done") return false;
  const due = startOfDay(parseISO(task.due_date));
  return isPast(due) && !isToday(due);
}

interface MarketingKanbanCardProps {
  task: MarketingTask;
  onEdit: () => void;
  onToggleComplete: (completed: boolean) => void;
  subtaskInfo?: { total: number; completed: number };
}

const priorityConfig = {
  low: { label: "Baixa", className: "bg-muted text-foreground dark:bg-slate-800 dark:text-muted-foreground" },
  medium: { label: "Média", className: "bg-warning-soft text-warning-strong dark:bg-warning/50 dark:text-warning" },
  high: { label: "Alta", className: "bg-danger-soft text-danger-strong dark:bg-danger/50 dark:text-danger" },
};

export function MarketingKanbanCard({
  task,
  onEdit,
  onToggleComplete,
  subtaskInfo,
}: MarketingKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueDate = task.due_date ? parseLocalDate(task.due_date) : null;
  const isPastDue = dueDate && isPast(dueDate) && !isToday(dueDate) && !task.is_completed;
  const isDueToday = dueDate && isToday(dueDate);
  const isDueTomorrow = dueDate && isTomorrow(dueDate);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm cursor-pointer transition-all",
        "hover:shadow-md hover:border-primary/30",
        isDragging && "opacity-50 shadow-lg rotate-2",
        task.is_completed && "opacity-60",
        isTaskOverdue(task) && "border-destructive/60 bg-destructive/5 hover:border-destructive"
      )}
      onClick={onEdit}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        </div>

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(!task.is_completed);
          }}
          className="mt-0.5 shrink-0"
        >
          {task.is_completed ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "text-sm font-medium line-clamp-2 flex-1",
                task.is_completed && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </p>
            {isTaskOverdue(task) && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-1 shrink-0">
                <AlertCircle className="h-3 w-3" />
                Atrasada
              </Badge>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Media attachments indicator */}
            {task.media_attachments && task.media_attachments.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                <span>{task.media_attachments.length}</span>
              </div>
            )}

            {/* Subtasks indicator */}
            {subtaskInfo && subtaskInfo.total > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ListTodo className="h-3 w-3" />
                <span>
                  {subtaskInfo.completed}/{subtaskInfo.total}
                </span>
              </div>
            )}

            {/* Due date */}
            {dueDate && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs",
                  isPastDue && "text-destructive",
                  isDueToday && "text-warning dark:text-warning",
                  isDueTomorrow && "text-info dark:text-info",
                  !isPastDue && !isDueToday && !isDueTomorrow && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3 w-3" />
                {isDueToday
                  ? "Hoje"
                  : isDueTomorrow
                  ? "Amanhã"
                  : format(dueDate, "dd MMM", { locale: ptBR })}
              </div>
            )}

            {/* Priority badge */}
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                priorityConfig[task.priority].className
              )}
            >
              {priorityConfig[task.priority].label}
            </span>
          </div>
        </div>

        {/* Assignee */}
        {task.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={task.assignee.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(task.assignee.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
