import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ListTodo,
  Filter,
  TrendingUp,
  ArrowUpDown,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar,
  ArrowRight,
  XCircle,
  User2,
  List,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskKanban } from "@/components/tasks/TaskKanban";
import { TaskStatusManager } from "@/components/tasks/TaskStatusManager";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { cn } from "@/lib/utils";
import { FilterBar, FilterItem } from "@/components/ui/filter-bar";
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
  custom_status_id: string | null;
}

type SortOption = "priority" | "due_date" | "created_at";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_CONFIG = {
  urgent: { label: "Urgente", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  high: { label: "Alta", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  medium: { label: "Média", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
};

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, className: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em andamento", icon: ArrowRight, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  done: { label: "Concluído", icon: CheckCircle2, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  overdue: { label: "Atrasado", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "bg-muted text-muted-foreground" },
};

type ViewMode = "list" | "kanban";

export default function Tasks() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialStatus, setInitialStatus] = useState<Task["status"] | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [statusManagerOpen, setStatusManagerOpen] = useState(false);

  // Custom task statuses
  const { statuses: customStatuses, isLoading: statusesLoading } = useTaskStatuses();

  // Set default active tab when statuses load
  useEffect(() => {
    if (customStatuses.length > 0 && activeTab === null) {
      setActiveTab(customStatuses[0].id);
    }
  }, [customStatuses, activeTab]);

  // Fetch tasks with React Query
  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ["internal-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_tasks")
        .select(`
          *,
          clients:client_id (id, full_name),
          assigned_user:users!internal_tasks_assigned_to_fkey (id, name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Task[];
    },
    staleTime: 30000,
  });

  // Fetch users with React Query
  const { data: users = [] } = useQuery({
    queryKey: ["team-users-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .order("name");
      return (data || []) as User[];
    },
    staleTime: 60000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "internal_tasks" },
        () => queryClient.invalidateQueries({ queryKey: ["internal-tasks"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const invalidateTasks = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["internal-tasks"] });
  }, [queryClient]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    const { error } = await supabase
      .from("internal_tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao atualizar tarefa");
    } else {
      toast.success(newStatus === "done" ? "Tarefa concluída!" : "Tarefa reaberta");
      invalidateTasks();
    }
  }, [invalidateTasks]);

  const handleDeleteTask = useCallback(async () => {
    if (!taskToDelete) return;

    const { error } = await supabase
      .from("internal_tasks")
      .delete()
      .eq("id", taskToDelete.id);

    if (error) {
      toast.error("Erro ao excluir tarefa");
    } else {
      toast.success("Tarefa excluída!");
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      invalidateTasks();
    }
  }, [taskToDelete, invalidateTasks]);

  const handleStatusChange = useCallback(async (taskId: string, newStatusId: string) => {
    // Find the status to check if it's a completed status
    const newStatus = customStatuses.find(s => s.id === newStatusId);
    const isCompleted = newStatus?.is_completed_status || false;
    
    const { error } = await supabase
      .from("internal_tasks")
      .update({
        custom_status_id: newStatusId,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao mover tarefa");
    } else {
      toast.success("Tarefa movida!");
      invalidateTasks();
    }
  }, [invalidateTasks, customStatuses]);

  const handlePriorityChange = useCallback(async (taskId: string, newPriority: Task["priority"]) => {
    const { error } = await supabase
      .from("internal_tasks")
      .update({ priority: newPriority })
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao alterar prioridade");
    } else {
      toast.success("Prioridade atualizada!");
      invalidateTasks();
    }
  }, [invalidateTasks]);

  const handleDueDateChange = useCallback(async (taskId: string, newDate: string | null) => {
    const { error } = await supabase
      .from("internal_tasks")
      .update({ due_date: newDate })
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao alterar prazo");
    } else {
      toast.success("Prazo atualizado!");
      invalidateTasks();
    }
  }, [invalidateTasks]);

  const openEditDialog = useCallback((task: Task) => {
    setEditingTask(task);
    setInitialStatus(undefined);
    setDialogOpen(true);
  }, []);

  const openNewTaskDialog = useCallback((status?: Task["status"]) => {
    setEditingTask(null);
    setInitialStatus(status);
    setDialogOpen(true);
  }, []);

  const openDeleteDialog = useCallback((task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  }, []);

  const getInitials = useCallback((name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }, []);

  const getDueDateInfo = useCallback((task: Task) => {
    if (!task.due_date) return null;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    const daysDiff = differenceInDays(dueDate, today);
    const taskStatus = customStatuses.find(s => s.id === task.custom_status_id);
    const isCompleted = taskStatus?.is_completed_status || false;
    const formattedDate = format(dueDate, "dd/MM", { locale: ptBR });
    
    if (isCompleted) {
      return { text: formattedDate, className: "text-muted-foreground" };
    }
    
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
  }, [customStatuses]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.clients?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUser = filterUser === "all" || 
      filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser;

    // Filter by custom_status_id - also include tasks without status in first tab
    const defaultStatus = customStatuses.find(s => s.is_default);
    const matchesTab = activeTab 
      ? task.custom_status_id === activeTab || 
        (!task.custom_status_id && activeTab === defaultStatus?.id)
      : true;

    return matchesSearch && matchesUser && matchesTab;
  }), [tasks, searchTerm, filterUser, currentUser?.id, activeTab, customStatuses]);

  // Sort tasks
  const sortedTasks = useMemo(() => [...filteredTasks].sort((a, b) => {
    if (sortBy === "priority") {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    } else if (sortBy === "due_date") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    } else {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  }), [filteredTasks, sortBy]);

  // Count tasks per status
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    customStatuses.forEach(status => {
      counts[status.id] = tasks.filter(t => t.custom_status_id === status.id).length;
    });
    return counts;
  }, [tasks, customStatuses]);

  // For stats cards, get counts from custom statuses by name
  const { pendingCount, overdueCount, inProgressCount, doneCount } = useMemo(() => {
    // Find status IDs by name patterns
    const pendingStatus = customStatuses.find(s => s.name.toLowerCase().includes('pendente'));
    const inProgressStatus = customStatuses.find(s => s.name.toLowerCase().includes('andamento'));
    const doneStatus = customStatuses.find(s => s.is_completed_status || s.name.toLowerCase().includes('conclu'));
    
    const pendingCount = tasks.filter(t => 
      t.custom_status_id === pendingStatus?.id || 
      (!t.custom_status_id && pendingStatus?.is_default)
    ).length;
    
    const inProgressCount = tasks.filter(t => t.custom_status_id === inProgressStatus?.id).length;
    const doneCount = tasks.filter(t => t.custom_status_id === doneStatus?.id).length;
    
    // Count overdue from non-completed tasks
    const completedStatusIds = customStatuses.filter(s => s.is_completed_status).map(s => s.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueCount = tasks.filter(t => {
      if (!t.due_date || completedStatusIds.includes(t.custom_status_id || '')) return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    }).length;

    return { pendingCount, overdueCount, inProgressCount, doneCount };
  }, [tasks, customStatuses]);

  if (loading) {
    return <LoadingScreen message="Carregando tarefas..." fullScreen={false} />;
  }

  const TaskTable = ({ tasks }: { tasks: Task[] }) => (
    <Card className="shadow-card overflow-hidden">
      <ScrollArea className="w-full">
        <div className="min-w-max">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="font-medium min-w-[250px]">Tarefa</TableHead>
                <TableHead className="font-medium text-center min-w-[100px]">Status</TableHead>
                <TableHead className="font-medium text-center min-w-[100px]">Prioridade</TableHead>
                <TableHead className="font-medium text-center min-w-[100px]">Prazo</TableHead>
                <TableHead className="font-medium min-w-[150px]">Cliente</TableHead>
                <TableHead className="font-medium text-center min-w-[80px]">Responsável</TableHead>
                <TableHead className="font-medium text-right min-w-[60px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <div className="p-4 rounded-full bg-muted/50 mb-4">
                        <ClipboardList className="h-10 w-10 opacity-50" />
                      </div>
                      <p className="font-medium">Nenhuma tarefa encontrada</p>
                      <p className="text-sm mt-1">Clique em "Nova Tarefa" para começar</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => {
                  // Find the custom status for this task
                  const taskStatus = customStatuses.find(s => s.id === task.custom_status_id);
                  const isCompleted = taskStatus?.is_completed_status || false;
                  const priorityConfig = PRIORITY_CONFIG[task.priority];
                  const dueDateInfo = getDueDateInfo(task);

                  return (
                    <TableRow 
                      key={task.id} 
                      className={cn(
                        "hover:bg-muted/30",
                        isCompleted && "opacity-60"
                      )}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => {
                            // Find first completed status or first non-completed status
                            const completedStatus = customStatuses.find(s => s.is_completed_status);
                            const pendingStatus = customStatuses.find(s => !s.is_completed_status);
                            const newStatusId = isCompleted ? pendingStatus?.id : completedStatus?.id;
                            if (newStatusId) handleStatusChange(task.id, newStatusId as Task["status"]);
                          }}
                          className={cn(
                            "h-4 w-4 rounded-full border transition-colors",
                            isCompleted ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/40"
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            isCompleted && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[300px]">
                              {task.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button 
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                              style={{ 
                                backgroundColor: taskStatus ? `${taskStatus.color}20` : undefined,
                                color: taskStatus?.color 
                              }}
                            >
                              <span 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: taskStatus?.color }}
                              />
                              <span>{taskStatus?.name || "Sem status"}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-44">
                            {customStatuses.map((status) => (
                              <DropdownMenuItem
                                key={status.id}
                                onClick={() => handleStatusChange(task.id, status.id as Task["status"])}
                                className={cn(task.custom_status_id === status.id && "bg-muted")}
                              >
                                <span 
                                  className="mr-2 w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: status.color }}
                                />
                                {status.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn(
                              "inline-flex px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity",
                              priorityConfig.className
                            )}>
                              {priorityConfig.label}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-32">
                            {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                              <DropdownMenuItem
                                key={priority}
                                onClick={() => handlePriorityChange(task.id, priority as Task["priority"])}
                                className={cn(task.priority === priority && "bg-muted")}
                              >
                                <span className={cn("w-2 h-2 rounded-full mr-2", 
                                  priority === "urgent" && "bg-red-500",
                                  priority === "high" && "bg-orange-500",
                                  priority === "medium" && "bg-blue-500",
                                  priority === "low" && "bg-muted-foreground"
                                )} />
                                {config.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn(
                              "inline-flex items-center gap-1 text-xs cursor-pointer hover:opacity-80 transition-opacity",
                              dueDateInfo ? dueDateInfo.className : "text-muted-foreground"
                            )}>
                              <Calendar className="h-3 w-3" />
                              <span>{dueDateInfo ? dueDateInfo.text : "Definir"}</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-36">
                            <DropdownMenuItem onClick={() => handleDueDateChange(task.id, new Date().toISOString().split('T')[0])}>
                              Hoje
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              handleDueDateChange(task.id, tomorrow.toISOString().split('T')[0]);
                            }}>
                              Amanhã
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const nextWeek = new Date();
                              nextWeek.setDate(nextWeek.getDate() + 7);
                              handleDueDateChange(task.id, nextWeek.toISOString().split('T')[0]);
                            }}>
                              Em 1 semana
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const nextMonth = new Date();
                              nextMonth.setMonth(nextMonth.getMonth() + 1);
                              handleDueDateChange(task.id, nextMonth.toISOString().split('T')[0]);
                            }}>
                              Em 1 mês
                            </DropdownMenuItem>
                            {task.due_date && (
                              <DropdownMenuItem 
                                onClick={() => handleDueDateChange(task.id, null)}
                                className="text-destructive"
                              >
                                Remover prazo
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        {task.clients ? (
                          <Link 
                            to={`/clients/${task.client_id}`}
                            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
                          >
                            <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[120px]">{task.clients.full_name}</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {task.assigned_user ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar className="h-7 w-7 mx-auto border-2 border-background shadow-sm">
                                  <AvatarImage src={task.assigned_user.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                                    {getInitials(task.assigned_user.name)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <span className="font-medium">{task.assigned_user.name}</span>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => openEditDialog(task)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openDeleteDialog(task)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </Card>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                <ListTodo className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie suas tarefas e acompanhe o progresso
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg p-1 bg-muted/50">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-8 px-3"
              >
                <List className="h-4 w-4 mr-1.5" />
                Lista
              </Button>
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8 px-3"
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Kanban
              </Button>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setStatusManagerOpen(true)}
              className="h-9"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              Personalizar
            </Button>
            <Button 
              onClick={() => openNewTaskDialog()}
              className="shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-500/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</p>
                  <p className="text-3xl font-bold mt-1">{pendingCount}</p>
                </div>
                <div className="p-2.5 rounded-full bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Em andamento</p>
                  <p className="text-3xl font-bold mt-1">{inProgressCount}</p>
                </div>
                <div className="p-2.5 rounded-full bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-l-4 bg-gradient-to-r to-transparent",
            overdueCount > 0 
              ? "border-l-destructive from-destructive/5" 
              : "border-l-muted from-muted/5"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Atrasadas</p>
                  <p className={cn(
                    "text-3xl font-bold mt-1",
                    overdueCount > 0 && "text-destructive"
                  )}>{overdueCount}</p>
                </div>
                <div className={cn(
                  "p-2.5 rounded-full",
                  overdueCount > 0 ? "bg-destructive/10" : "bg-muted"
                )}>
                  <AlertTriangle className={cn(
                    "h-5 w-5",
                    overdueCount > 0 ? "text-destructive" : "text-muted-foreground"
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-500/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concluídas</p>
                  <p className="text-3xl font-bold mt-1">{doneCount}</p>
                </div>
                <div className="p-2.5 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por título, descrição ou cliente..."
        filtersActive={filterUser !== "all"}
        onClearFilters={() => setFilterUser("all")}
      >
        <FilterItem>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-full sm:w-[180px] h-10">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Responsável" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mine">
                <div className="flex items-center gap-2">
                  <span>🎯</span>
                  <span>Minhas tarefas</span>
                </div>
              </SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px]">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterItem>
        <FilterItem>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-[160px] h-10">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Ordenar por" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">Prioridade</SelectItem>
              <SelectItem value="due_date">Data de entrega</SelectItem>
              <SelectItem value="created_at">Data de criação</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>
      </FilterBar>

      {/* Content based on view mode */}
      {viewMode === "kanban" ? (
        <TaskKanban
          tasks={tasks.filter((task) => {
            const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              task.clients?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesUser = filterUser === "all" || 
              filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser;

            return matchesSearch && matchesUser;
          })}
          onEditTask={openEditDialog}
          onDeleteTask={openDeleteDialog}
          onStatusChange={handleStatusChange}
          onAddTask={openNewTaskDialog}
        />
      ) : (
        <Tabs value={activeTab || ""} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
            {customStatuses.map((status) => (
              <TabsTrigger 
                key={status.id} 
                value={status.id} 
                className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: status.color }}
                />
                {status.name}
                {(statusCounts[status.id] || 0) > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-1">
                    {statusCounts[status.id]}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {customStatuses.map((status) => (
            <TabsContent key={status.id} value={status.id} className="mt-6">
              <TaskTable tasks={sortedTasks} />
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        initialStatus={initialStatus}
        onSuccess={invalidateTasks}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa "{taskToDelete?.title}" será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Manager Dialog */}
      <TaskStatusManager 
        open={statusManagerOpen} 
        onOpenChange={setStatusManagerOpen} 
      />
    </div>
  );
}
