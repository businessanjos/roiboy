import { format, isPast, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface MarketingTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  custom_status_id: string | null;
  activity_type_id: string | null;
  assigned_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  custom_status: {
    id: string;
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  activity_type: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface MarketingTaskRowProps {
  task: MarketingTask;
  onEdit: () => void;
  onToggleComplete: () => void;
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Média", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  urgent: { label: "Urgente", className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export default function MarketingTaskRow({
  task,
  onEdit,
  onToggleComplete,
}: MarketingTaskRowProps) {
  const isCompleted = !!task.completed_at;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getDueDateDisplay = () => {
    if (!task.due_date) return null;

    const date = parseISO(task.due_date);
    const isOverdue = !isCompleted && isPast(date) && !isToday(date);
    const isDueToday = isToday(date);

    let className = "text-muted-foreground";
    if (isOverdue) className = "text-red-600 dark:text-red-400 font-medium";
    else if (isDueToday) className = "text-amber-600 dark:text-amber-400 font-medium";

    return (
      <span className={className}>
        {isDueToday ? "Hoje" : format(date, "dd MMM", { locale: ptBR })}
        {task.due_time && ` ${task.due_time.slice(0, 5)}`}
      </span>
    );
  };

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  return (
    <TableRow
      className={cn(
        "group cursor-pointer transition-colors",
        isCompleted && "opacity-60"
      )}
      onClick={onEdit}
    >
      <TableCell className="w-[40px]" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isCompleted}
          onCheckedChange={onToggleComplete}
          className={cn(
            "transition-colors",
            isCompleted && "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          )}
        />
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span
            className={cn(
              "font-medium",
              isCompleted && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </span>
          {task.description && (
            <span className="text-sm text-muted-foreground line-clamp-1">
              {task.description}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell>
        {task.assigned_user ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={task.assigned_user.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">
                {getInitials(task.assigned_user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate max-w-[80px]">
              {task.assigned_user.name.split(" ")[0]}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>{getDueDateDisplay() || <span className="text-muted-foreground">—</span>}</TableCell>

      <TableCell>
        <Badge variant="secondary" className={cn("font-normal", priorityConfig.className)}>
          {priorityConfig.label}
        </Badge>
      </TableCell>

      <TableCell>
        {task.custom_status ? (
          <Badge
            variant="outline"
            className="font-normal"
            style={{
              borderColor: task.custom_status.color,
              color: task.custom_status.color,
            }}
          >
            {task.custom_status.name}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
