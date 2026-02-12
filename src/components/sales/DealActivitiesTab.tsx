import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate, formatLocalDate } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  ListTodo,
} from "lucide-react";
import { TaskDialog } from "@/components/tasks/TaskDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  custom_status_id: string | null;
  assigned_to: string | null;
  deal_id: string | null;
  lead_id: string | null;
  client_id: string | null;
  activity_type_id: string | null;
  meeting_url: string | null;
  meeting_platform: string | null;
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  custom_status?: {
    id: string;
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  activity_type?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface DealActivitiesTabProps {
  dealId: string;
  leadId?: string | null;
}

const PRIORITY_CONFIG = {
  low: { label: "Baixa", color: "bg-slate-500" },
  medium: { label: "Média", color: "bg-blue-500" },
  high: { label: "Alta", color: "bg-amber-500" },
  urgent: { label: "Urgente", color: "bg-red-500" },
};

const COMPUTED_STATUS_CONFIG = {
  pending: { label: "Pendente", color: "text-gray-600", bgColor: "bg-gray-100", borderColor: "border-gray-300" },
  overdue: { label: "Atrasada", color: "text-red-600", bgColor: "bg-red-100", borderColor: "border-red-300" },
  done: { label: "Feita", color: "text-emerald-600", bgColor: "bg-emerald-100", borderColor: "border-emerald-300" },
};

const getComputedStatus = (task: Task): "pending" | "overdue" | "done" => {
  if (task.completed_at) return "done";
  
  if (task.due_date) {
    const date = parseLocalDate(task.due_date);
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return "overdue";
    }
  }
  
  return "pending";
};

export function DealActivitiesTab({ dealId, leadId }: DealActivitiesTabProps) {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  useEffect(() => {
    fetchTasks();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`deal-tasks-${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_tasks",
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("internal_tasks")
      .select(`
        id,
        title,
        description,
        status,
        priority,
        due_date,
        due_time,
        completed_at,
        custom_status_id,
        assigned_to,
        deal_id,
        lead_id,
        client_id,
        activity_type_id,
        meeting_url,
        meeting_platform,
        assigned_user:users!internal_tasks_assigned_to_fkey(id, name, avatar_url),
        custom_status:task_statuses!internal_tasks_custom_status_id_fkey(id, name, color, is_completed_status),
        activity_type:activity_types!internal_tasks_activity_type_id_fkey(id, name, color)
      `)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
    } else {
      setTasks((data || []) as Task[]);
    }
    setLoading(false);
  };

  const handleToggleComplete = async (task: Task) => {
    const isCurrentlyCompleted = task.custom_status?.is_completed_status || task.completed_at !== null;
    
    // Find the first non-completed status or the first completed status
    const { data: statuses } = await supabase
      .from("task_statuses")
      .select("id, is_completed_status")
      .order("display_order");
    
    if (!statuses || statuses.length === 0) return;

    const targetStatus = isCurrentlyCompleted
      ? statuses.find(s => !s.is_completed_status)
      : statuses.find(s => s.is_completed_status);

    if (!targetStatus) return;

    const { error } = await supabase
      .from("internal_tasks")
      .update({
        custom_status_id: targetStatus.id,
        completed_at: targetStatus.is_completed_status ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (error) {
      console.error("Error updating task:", error);
    } else {
      await fetchTasks();
      // Invalidate global cache to sync with Tasks page
      queryClient.invalidateQueries({ queryKey: ["internal-tasks"] });
      
      if (!isCurrentlyCompleted) {
        setEditingTask(null);
        setTaskDialogOpen(true);
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const isOverdue = (dueDate: string | null, completedAt: string | null) => {
    if (!dueDate || completedAt) return false;
    const date = parseLocalDate(dueDate);
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const pendingTasks = tasks.filter(t => !t.custom_status?.is_completed_status && !t.completed_at);
  const completedTasks = tasks.filter(t => t.custom_status?.is_completed_status || t.completed_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm flex items-center gap-1.5 text-muted-foreground">
          <ListTodo className="h-3.5 w-3.5" />
          Atividades ({pendingTasks.length} pendentes)
        </h4>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            setEditingTask(null);
            setTaskDialogOpen(true);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Nova Atividade
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs border rounded-lg bg-muted/30">
          <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhuma atividade agendada</p>
          <p className="text-[10px] mt-1">Clique em "Nova Atividade" para agendar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div className="rounded-lg border bg-muted/30 divide-y">
              {pendingTasks.map((task) => {
                const priorityConfig = PRIORITY_CONFIG[task.priority];
                const overdue = isOverdue(task.due_date, task.completed_at);

                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-2 p-2.5 hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setEditingTask(task);
                      setTaskDialogOpen(true);
                    }}
                  >
                    <Checkbox
                      checked={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleComplete(task);
                      }}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{task.activity_type?.name || task.title}</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full", priorityConfig.color)} />
                        {overdue && (
                          <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        {task.due_date && (
                          <span className={cn("flex items-center gap-0.5", overdue && "text-red-500")}>
                            <Calendar className="h-2.5 w-2.5" />
                            {formatLocalDate(task.due_date)}
                          </span>
                        )}
                        {(() => {
                          const computedStatus = getComputedStatus(task);
                          const config = COMPUTED_STATUS_CONFIG[computedStatus];
                          return (
                            <Badge
                              variant="outline"
                              className={cn("text-[9px] h-4 px-1", config.bgColor, config.color, config.borderColor)}
                            >
                              {config.label}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>
                    {task.assigned_user && (
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={task.assigned_user.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                          {getInitials(task.assigned_user.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Concluídas ({completedTasks.length})
              </p>
              <div className="rounded-lg border bg-muted/20 divide-y opacity-70">
                {completedTasks.slice(0, showAllCompleted ? completedTasks.length : 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30"
                    onClick={() => {
                      setEditingTask(task);
                      setTaskDialogOpen(true);
                    }}
                  >
                    <Checkbox checked className="mt-0" />
                    <span className="text-xs line-through text-muted-foreground truncate flex-1">
                      {task.activity_type?.name || task.title}
                    </span>
                    {task.completed_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(task.completed_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    )}
                  </div>
                ))}
                {completedTasks.length > 5 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllCompleted(!showAllCompleted);
                    }}
                    className="w-full text-center text-[10px] text-muted-foreground py-1.5 hover:bg-muted/30 cursor-pointer"
                  >
                    {showAllCompleted ? "Mostrar menos" : `+ ${completedTasks.length - 5} outras`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask as any}
        dealId={dealId}
        leadId={leadId || undefined}
        onSuccess={fetchTasks}
        onTaskCompleted={async () => {
          await fetchTasks();
          queryClient.invalidateQueries({ queryKey: ["internal-tasks"] });
          setEditingTask(null);
          setTaskDialogOpen(true);
        }}
      />
    </div>
  );
}
