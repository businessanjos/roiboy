import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Calendar, 
  User as UserIcon,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { format, isPast, isToday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface Client {
  id: string;
  full_name: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "done" | "overdue" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  client_id: string | null;
  assigned_to: string | null;
  created_at: string;
  clients?: Client | null;
  assigned_user?: User | null;
}

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  showClient?: boolean;
}

const PRIORITY_CONFIG = {
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
  medium: { label: "Média", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  high: { label: "Alta", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  urgent: { label: "Urgente", className: "bg-destructive/10 text-destructive" },
};

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, className: "text-muted-foreground" },
  in_progress: { label: "Em andamento", icon: ArrowRight, className: "text-blue-500" },
  done: { label: "Concluído", icon: CheckCircle2, className: "text-green-500" },
  overdue: { label: "Atrasado", icon: AlertTriangle, className: "text-destructive" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "text-muted-foreground" },
};

export function TaskCard({ task, onEdit, onDelete, onToggleComplete, showClient = true }: TaskCardProps) {
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const statusConfig = STATUS_CONFIG[task.status];
  const StatusIcon = statusConfig.icon;
  const isCompleted = task.status === "done";
  const isCancelled = task.status === "cancelled";

  const getDueDateInfo = () => {
    if (!task.due_date) return null;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    const daysDiff = differenceInDays(dueDate, today);
    
    if (isCompleted || isCancelled) {
      return { text: format(dueDate, "dd/MM", { locale: ptBR }), className: "text-muted-foreground" };
    }
    
    if (daysDiff < 0) {
      return { text: `Atrasado ${Math.abs(daysDiff)}d`, className: "text-destructive" };
    }
    if (daysDiff === 0) {
      return { text: "Hoje", className: "text-amber-600 dark:text-amber-400" };
    }
    if (daysDiff === 1) {
      return { text: "Amanhã", className: "text-amber-600 dark:text-amber-400" };
    }
    if (daysDiff <= 7) {
      return { text: `${daysDiff}d`, className: "text-foreground" };
    }
    return { text: format(dueDate, "dd/MM", { locale: ptBR }), className: "text-muted-foreground" };
  };

  const dueDateInfo = getDueDateInfo();

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg border bg-card transition-colors hover:bg-muted/50",
        (isCompleted || isCancelled) && "opacity-60"
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggleComplete(task)}
        className="mt-0.5"
        disabled={isCancelled}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-sm",
              (isCompleted || isCancelled) && "line-through text-muted-foreground"
            )}>
              {task.title}
            </p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(task)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className={cn("text-[10px] h-5", priorityConfig.className)}>
            {priorityConfig.label}
          </Badge>

          <div className={cn("flex items-center gap-1 text-xs", statusConfig.className)}>
            <StatusIcon className="h-3 w-3" />
            <span>{statusConfig.label}</span>
          </div>

          {dueDateInfo && (
            <div className={cn("flex items-center gap-1 text-xs", dueDateInfo.className)}>
              <Calendar className="h-3 w-3" />
              <span>{dueDateInfo.text}</span>
            </div>
          )}

          {showClient && task.clients && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {task.clients.full_name}
            </span>
          )}

          {task.assigned_user && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-5 w-5 ml-auto">
                    <AvatarImage src={task.assigned_user.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px] bg-primary/10">
                      {getInitials(task.assigned_user.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {task.assigned_user.name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}
