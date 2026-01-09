import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Edit, 
  AlertTriangle, 
  ChevronDown,
  ChevronRight,
  User
} from "lucide-react";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TaskDialog } from "@/components/tasks/TaskDialog";

interface Activity {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: string;
  completed_at: string | null;
  created_at: string;
  activity_type?: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  custom_status?: {
    id: string;
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  assigned_user?: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

interface DealActivitiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  leadId?: string;
}

type ActivityStatus = "todo" | "overdue" | "done";

export function DealActivitiesDialog({ 
  open, 
  onOpenChange, 
  dealId, 
  leadId 
}: DealActivitiesDialogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Activity | null>(null);
  const [doneExpanded, setDoneExpanded] = useState(false);

  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("internal_tasks")
      .select(`
        id,
        title,
        description,
        due_date,
        due_time,
        priority,
        completed_at,
        created_at,
        activity_type:activity_types(id, name, color, icon),
        custom_status:task_statuses!internal_tasks_custom_status_id_fkey(id, name, color, is_completed_status),
        assigned_user:users!internal_tasks_assigned_to_fkey(id, name, avatar_url)
      `)
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching activities:", error);
      toast.error("Erro ao carregar atividades");
    } else {
      setActivities(data as Activity[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && dealId) {
      fetchActivities();

      // Subscribe to realtime changes
      const channel = supabase
        .channel(`deal-activities-${dealId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "internal_tasks", filter: `deal_id=eq.${dealId}` },
          () => fetchActivities()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [open, dealId]);

  const getActivityStatus = (activity: Activity): ActivityStatus => {
    // If completed
    if (activity.completed_at || activity.custom_status?.is_completed_status) {
      return "done";
    }

    // If has due date and it's in the past
    if (activity.due_date) {
      const dueDate = startOfDay(new Date(activity.due_date + 'T00:00:00'));
      const today = startOfDay(new Date());
      
      if (isBefore(dueDate, today)) {
        return "overdue";
      }
    }

    return "todo";
  };

  const categorizeActivities = () => {
    const todo: Activity[] = [];
    const overdue: Activity[] = [];
    const done: Activity[] = [];

    activities.forEach(activity => {
      const status = getActivityStatus(activity);
      if (status === "todo") todo.push(activity);
      else if (status === "overdue") overdue.push(activity);
      else done.push(activity);
    });

    return { todo, overdue, done };
  };

  const { todo, overdue, done } = categorizeActivities();

  const handleCompleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Find first completed status
    const { data: statuses } = await supabase
      .from("task_statuses")
      .select("id, is_completed_status")
      .eq("is_completed_status", true)
      .limit(1);

    if (!statuses || statuses.length === 0) {
      toast.error("Nenhum status de conclusão configurado");
      return;
    }

    const { error } = await supabase
      .from("internal_tasks")
      .update({
        custom_status_id: statuses[0].id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao concluir atividade");
    } else {
      toast.success("Atividade concluída!");
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const renderActivityItem = (activity: Activity, status: ActivityStatus) => {
    const isDone = status === "done";
    const isOverdue = status === "overdue";

    return (
      <div 
        key={activity.id}
        className={cn(
          "p-3 rounded-lg border transition-colors group",
          isDone && "bg-muted/30 border-muted",
          isOverdue && "bg-destructive/5 border-destructive/30",
          !isDone && !isOverdue && "bg-primary/5 border-primary/20 hover:bg-primary/10"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {activity.activity_type && (
                <span 
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activity.activity_type.color }}
                />
              )}
              <span className={cn(
                "font-medium text-sm",
                isDone && "text-muted-foreground line-through"
              )}>
                {activity.activity_type?.name || activity.title}
              </span>
              {isOverdue && (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              )}
            </div>
            
            {activity.description && (
              <p className={cn(
                "text-xs text-muted-foreground mt-1 line-clamp-2",
                isDone && "opacity-60"
              )}>
                {activity.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {activity.due_date && (
                <div className={cn(
                  "flex items-center gap-1 text-xs",
                  isOverdue ? "text-destructive" : "text-muted-foreground"
                )}>
                  <Calendar className="h-3 w-3" />
                  <span>
                    {format(new Date(activity.due_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                    {activity.due_time && ` às ${activity.due_time.slice(0, 5)}`}
                  </span>
                </div>
              )}
              
              {activity.assigned_user && (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={activity.assigned_user.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {getInitials(activity.assigned_user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {activity.assigned_user.name.split(" ")[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={cn(
            "flex items-center gap-1",
            !isDone && "opacity-0 group-hover:opacity-100 transition-opacity"
          )}>
            {!isDone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-emerald-500/20 hover:text-emerald-600"
                onClick={(e) => handleCompleteTask(activity.id, e)}
                title="Concluir"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary/20"
              onClick={(e) => {
                e.stopPropagation();
                setEditingTask(activity);
                setTaskDialogOpen(true);
              }}
              title="Editar"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Atividades
            </DialogTitle>
          </DialogHeader>

          <Button
            onClick={() => {
              setEditingTask(null);
              setTaskDialogOpen(true);
            }}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agendar Atividade
          </Button>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma atividade ainda</p>
                <p className="text-xs">Clique em "Agendar Atividade" para criar uma</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {/* Overdue Section */}
                {overdue.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <h3 className="text-sm font-semibold text-destructive">
                        Atrasado ({overdue.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {overdue.map(activity => renderActivityItem(activity, "overdue"))}
                    </div>
                  </div>
                )}

                {/* To Do Section */}
                {todo.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-primary">
                        A Fazer ({todo.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {todo.map(activity => renderActivityItem(activity, "todo"))}
                    </div>
                  </div>
                )}

                {/* Done Section - Collapsible */}
                {done.length > 0 && (
                  <Collapsible open={doneExpanded} onOpenChange={setDoneExpanded}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-1 -ml-1">
                        {doneExpanded ? (
                          <ChevronDown className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-emerald-600" />
                        )}
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-emerald-600">
                          Feito ({done.length})
                        </h3>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-2">
                        {done.map(activity => renderActivityItem(activity, "done"))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask ? {
          id: editingTask.id,
          title: editingTask.title,
          description: editingTask.description,
          status: "pending",
          priority: editingTask.priority as "low" | "medium" | "high" | "urgent",
          due_date: editingTask.due_date,
          due_time: editingTask.due_time,
          client_id: null,
          deal_id: dealId,
          lead_id: leadId || null,
          assigned_to: editingTask.assigned_user?.id || null,
          completed_at: editingTask.completed_at,
          custom_status_id: editingTask.custom_status?.id,
          activity_type_id: editingTask.activity_type?.id,
        } : null}
        dealId={dealId}
        leadId={leadId}
        onSuccess={() => setEditingTask(null)}
      />
    </>
  );
}
