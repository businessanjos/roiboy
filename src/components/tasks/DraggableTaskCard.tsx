import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  GripVertical,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
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

interface DraggableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, className: "text-muted-foreground" },
  in_progress: { label: "Em andamento", icon: ArrowRight, className: "text-blue-500" },
  done: { label: "Concluído", icon: CheckCircle2, className: "text-green-500" },
  overdue: { label: "Atrasado", icon: AlertTriangle, className: "text-destructive" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "text-muted-foreground" },
};

export function DraggableTaskCard({ task, onEdit, onDelete, onToggleComplete }: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const statusConfig = STATUS_CONFIG[task.status];
  const StatusIcon = statusConfig.icon;
  const isCompleted = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const isOverdue = task.status === "overdue";

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
      return { text: `${Math.abs(daysDiff)}d`, className: "text-destructive font-medium" };
    }
    if (daysDiff === 0) {
      return { text: "Hoje", className: "text-amber-600 font-medium" };
    }
    if (daysDiff === 1) {
      return { text: "Amanhã", className: "text-amber-600" };
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
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-2 p-3 rounded-lg border bg-card transition-all duration-200",
        "hover:shadow-md",
        isDragging && "opacity-50 shadow-lg scale-105 z-50",
        isOverdue && "border-destructive/30 bg-destructive/5"
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1 -ml-1 rounded cursor-grab active:cursor-grabbing hover:bg-muted touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Checkbox */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggleComplete(task)}
        className={cn(
          "h-4 w-4 mt-0.5 rounded-full border-2",
          isCompleted && "bg-green-500 border-green-500"
        )}
        disabled={isCancelled}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm font-medium leading-tight line-clamp-2",
            (isCompleted || isCancelled) && "line-through text-muted-foreground"
          )}>
            {task.title}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(task)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <div className={cn(
            "flex items-center gap-1",
            statusConfig.className
          )}>
            <StatusIcon className="h-3 w-3" />
            <span>{statusConfig.label}</span>
          </div>

          {dueDateInfo && (
            <div className={cn("flex items-center gap-1", dueDateInfo.className)}>
              <Calendar className="h-3 w-3" />
              <span>{dueDateInfo.text}</span>
            </div>
          )}

          {task.assigned_user && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-5 w-5 ml-auto border border-background">
                    <AvatarImage src={task.assigned_user.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-primary/10">
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
