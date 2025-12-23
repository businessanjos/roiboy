import { useState, useMemo, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  XCircle,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  User2,
  GripVertical,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  clients: Client | null;
  assigned_user: User | null;
}

type TaskStatus = Task["status"];

interface TaskKanbanProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onAddTask: (status: TaskStatus) => void;
}

const STATUS_CONFIG: Record<TaskStatus, { 
  label: string; 
  icon: React.ElementType; 
  className: string;
  headerClass: string;
}> = {
  pending: { 
    label: "Pendente", 
    icon: Clock, 
    className: "bg-muted text-muted-foreground",
    headerClass: "border-t-amber-500"
  },
  in_progress: { 
    label: "Em andamento", 
    icon: ArrowRight, 
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    headerClass: "border-t-blue-500"
  },
  done: { 
    label: "Concluído", 
    icon: CheckCircle2, 
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    headerClass: "border-t-green-500"
  },
  overdue: { 
    label: "Atrasado", 
    icon: AlertTriangle, 
    className: "bg-destructive/10 text-destructive",
    headerClass: "border-t-destructive"
  },
  cancelled: { 
    label: "Cancelado", 
    icon: XCircle, 
    className: "bg-muted text-muted-foreground",
    headerClass: "border-t-muted-foreground"
  },
};

const PRIORITY_CONFIG = {
  urgent: { label: "Urgente", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Média", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
};

const COLUMNS: TaskStatus[] = ["pending", "in_progress", "done", "overdue", "cancelled"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getDueDateInfo(task: Task) {
  if (!task.due_date) return null;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  const daysDiff = differenceInDays(dueDate, today);
  const isCompleted = task.status === "done";
  const isCancelled = task.status === "cancelled";
  
  if (isCompleted || isCancelled) {
    return { text: format(dueDate, "dd MMM", { locale: ptBR }), className: "text-muted-foreground" };
  }
  
  if (daysDiff < 0) {
    return { text: `${Math.abs(daysDiff)}d atrasado`, className: "text-destructive font-medium" };
  }
  if (daysDiff === 0) {
    return { text: "Hoje", className: "text-amber-600 dark:text-amber-400 font-medium" };
  }
  if (daysDiff === 1) {
    return { text: "Amanhã", className: "text-amber-600 dark:text-amber-400" };
  }
  if (daysDiff <= 7) {
    return { text: `${daysDiff} dias`, className: "text-foreground" };
  }
  return { text: format(dueDate, "dd MMM", { locale: ptBR }), className: "text-muted-foreground" };
}

interface SortableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function SortableTaskCard({ task, onEdit, onDelete }: SortableTaskCardProps) {
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

  const dueDateInfo = getDueDateInfo(task);
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border rounded-lg p-3 shadow-sm transition-all hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-snug line-clamp-2">{task.title}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
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

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", priorityConfig.className)}>
              {priorityConfig.label}
            </Badge>

            {dueDateInfo && (
              <div className={cn("flex items-center gap-1 text-[10px]", dueDateInfo.className)}>
                <Calendar className="h-3 w-3" />
                <span>{dueDateInfo.text}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            {task.clients ? (
              <Link 
                to={`/clients/${task.client_id}`}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                <User2 className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{task.clients.full_name}</span>
              </Link>
            ) : (
              <span />
            )}

            {task.assigned_user && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarImage src={task.assigned_user.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-medium">
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
    </div>
  );
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

function KanbanColumn({ status, tasks, onEditTask, onDeleteTask, onAddTask }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Card className={cn("flex flex-col min-w-[280px] max-w-[320px] h-full border-t-4", config.headerClass)}>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4" />
            {config.label}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs font-normal">
              {tasks.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAddTask(status)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-3 pb-3">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
            {tasks.length === 0 && (
              <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg text-muted-foreground text-xs">
                Nenhuma tarefa
              </div>
            )}
          </div>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

export function TaskKanban({ tasks, onEditTask, onDeleteTask, onStatusChange, onAddTask }: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const tasksByStatus = useMemo(() => COLUMNS.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>), [tasks]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    // Find the column the task was dropped into
    let targetStatus: TaskStatus | null = null;

    // Check if dropped over a task
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask) {
      targetStatus = overTask.status;
    } else {
      // Dropped over a column directly
      targetStatus = over.id as TaskStatus;
    }

    if (targetStatus && targetStatus !== activeTask.status) {
      await onStatusChange(activeTask.id, targetStatus);
    }
  }, [tasks, onStatusChange]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 400px)" }}>
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onAddTask={onAddTask}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-card border rounded-lg p-3 shadow-xl ring-2 ring-primary opacity-90">
            <p className="font-medium text-sm">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
