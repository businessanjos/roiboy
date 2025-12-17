import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DraggableTaskCard } from "./DraggableTaskCard";
import { 
  AlertTriangle, 
  ArrowUp, 
  Minus, 
  ArrowDown,
} from "lucide-react";

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

type Priority = "urgent" | "high" | "medium" | "low";

interface TaskDropZoneProps {
  id: Priority;
  priority: Priority;
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

const PRIORITY_CONFIG: Record<Priority, {
  label: string;
  icon: React.ElementType;
  headerBg: string;
  borderColor: string;
  iconColor: string;
  badgeClass: string;
}> = {
  urgent: {
    label: "Urgente",
    icon: AlertTriangle,
    headerBg: "bg-gradient-to-r from-destructive/10 to-destructive/5",
    borderColor: "border-destructive/30",
    iconColor: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
  },
  high: {
    label: "Alta",
    icon: ArrowUp,
    headerBg: "bg-gradient-to-r from-amber-500/10 to-amber-500/5",
    borderColor: "border-amber-500/30",
    iconColor: "text-amber-600",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  medium: {
    label: "Média",
    icon: Minus,
    headerBg: "bg-gradient-to-r from-blue-500/10 to-blue-500/5",
    borderColor: "border-blue-500/30",
    iconColor: "text-blue-600",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  low: {
    label: "Baixa",
    icon: ArrowDown,
    headerBg: "bg-gradient-to-r from-muted to-muted/50",
    borderColor: "border-muted",
    iconColor: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground",
  },
};

export function TaskDropZone({ 
  id, 
  priority, 
  tasks, 
  onEdit, 
  onDelete, 
  onToggleComplete 
}: TaskDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border-2 border-dashed transition-all duration-200 min-h-[300px]",
        config.borderColor,
        isOver && "border-primary bg-primary/5 scale-[1.02]"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 rounded-t-lg",
        config.headerBg
      )}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", config.iconColor)} />
          <span className="font-semibold text-sm">{config.label}</span>
        </div>
        <Badge variant="outline" className={cn("text-[10px] h-5", config.badgeClass)}>
          {tasks.length}
        </Badge>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-2 space-y-2">
        {tasks.length === 0 ? (
          <div className={cn(
            "flex items-center justify-center h-24 rounded-lg border border-dashed text-muted-foreground text-sm",
            isOver && "border-primary bg-primary/5"
          )}>
            {isOver ? "Solte aqui" : "Arraste tarefas aqui"}
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleComplete={onToggleComplete}
            />
          ))
        )}
      </div>
    </div>
  );
}
