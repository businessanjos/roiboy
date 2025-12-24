import { useState, useMemo, useCallback } from "react";
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
  Circle,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTaskStatuses, TaskStatus as CustomTaskStatus } from "@/hooks/useTaskStatuses";

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
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  client_id: string | null;
  assigned_to: string | null;
  created_at: string;
  clients: Client | null;
  assigned_user: User | null;
  custom_status_id?: string | null;
}

interface TaskKanbanProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  onAddTask: (status: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  "clock": Clock,
  "arrow-right": ArrowRight,
  "check-circle-2": CheckCircle2,
  "x-circle": XCircle,
  "circle": Circle,
  "alert-triangle": AlertTriangle,
  "star": Star,
};

const PRIORITY_CONFIG = {
  urgent: { label: "Urgente", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Média", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function getIconComponent(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Circle;
}

function getDueDateInfo(task: Task, statuses: CustomTaskStatus[]) {
  if (!task.due_date) return null;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  const daysDiff = differenceInDays(dueDate, today);
  
  // Check if task is in a completed status
  const taskStatus = statuses.find(s => s.name.toLowerCase() === task.status.toLowerCase().replace('_', ' '));
  const isCompleted = taskStatus?.is_completed_status || task.status === "done" || task.status === "cancelled";
  
  if (isCompleted) {
    return { text: format(dueDate, "dd/MM", { locale: ptBR }), className: "text-muted-foreground" };
  }
  
  const formattedDate = format(dueDate, "dd/MM", { locale: ptBR });
  
  if (daysDiff < 0) {
    return { text: `${Math.abs(daysDiff)}d atrasado · ${formattedDate}`, className: "text-destructive font-medium" };
  }
  if (daysDiff === 0) {
    return { text: `Hoje · ${formattedDate}`, className: "text-amber-600 dark:text-amber-400 font-medium" };
  }
  if (daysDiff === 1) {
    return { text: `Amanhã · ${formattedDate}`, className: "text-amber-600 dark:text-amber-400" };
  }
  if (daysDiff <= 7) {
    return { text: `${daysDiff} dias · ${formattedDate}`, className: "text-foreground" };
  }
  return { text: formattedDate, className: "text-muted-foreground" };
}

interface SortableTaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  statuses: CustomTaskStatus[];
}

function SortableTaskCard({ task, onEdit, onDelete, statuses }: SortableTaskCardProps) {
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

  const dueDateInfo = getDueDateInfo(task, statuses);
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
  status: CustomTaskStatus;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAddTask: (status: string) => void;
  allStatuses: CustomTaskStatus[];
}

function KanbanColumn({ status, tasks, onEditTask, onDeleteTask, onAddTask, allStatuses }: KanbanColumnProps) {
  const Icon = getIconComponent(status.icon);

  return (
    <Card 
      className="flex flex-col min-w-[280px] max-w-[320px] h-full border-t-4"
      style={{ borderTopColor: status.color }}
    >
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4" style={{ color: status.color }} />
            {status.name}
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs font-normal">
              {tasks.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onAddTask(status.name.toLowerCase().replace(' ', '_'))}
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
                statuses={allStatuses}
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

// Map old status names to new ones
function normalizeStatus(status: string): string {
  const mapping: Record<string, string> = {
    "pending": "pendente",
    "in_progress": "em andamento",
    "done": "concluído",
    "cancelled": "cancelado",
    "overdue": "atrasado",
  };
  return mapping[status] || status.toLowerCase();
}

export function TaskKanban({ tasks, onEditTask, onDeleteTask, onStatusChange, onAddTask }: TaskKanbanProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const { statuses } = useTaskStatuses();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group tasks by status - match by status name (case-insensitive)
  const tasksByStatus = useMemo(() => {
    const result: Record<string, Task[]> = {};
    
    statuses.forEach((s) => {
      result[s.id] = [];
    });

    tasks.forEach((task) => {
      const normalizedTaskStatus = normalizeStatus(task.status);
      const matchingStatus = statuses.find(
        (s) => s.name.toLowerCase() === normalizedTaskStatus
      );
      
      if (matchingStatus) {
        result[matchingStatus.id].push(task);
      } else if (statuses.length > 0) {
        // Put in first column if no match
        result[statuses[0].id].push(task);
      }
    });

    return result;
  }, [tasks, statuses]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    // Find the column the task was dropped into
    let targetStatusId: string | null = null;

    // Check if dropped over a task
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask) {
      const normalizedStatus = normalizeStatus(overTask.status);
      const status = statuses.find((s) => s.name.toLowerCase() === normalizedStatus);
      targetStatusId = status?.id || null;
    } else {
      // Dropped over a column directly - over.id is the status id
      targetStatusId = over.id as string;
    }

    if (targetStatusId) {
      const targetStatus = statuses.find((s) => s.id === targetStatusId);
      if (targetStatus) {
        const currentNormalized = normalizeStatus(draggedTask.status);
        if (currentNormalized !== targetStatus.name.toLowerCase()) {
          // Convert status name to the format expected by the backend
          const statusKey = targetStatus.name.toLowerCase().replace(' ', '_');
          await onStatusChange(draggedTask.id, statusKey);
        }
      }
    }
  }, [tasks, statuses, onStatusChange]);

  if (statuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Carregando status...
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "calc(100vh - 400px)" }}>
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] || []}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onAddTask={onAddTask}
            allStatuses={statuses}
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
