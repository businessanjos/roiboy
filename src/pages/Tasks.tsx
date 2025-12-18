import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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

export default function Tasks() {
  const { currentUser } = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [activeTab, setActiveTab] = useState("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchUsers();

    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "internal_tasks" },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("internal_tasks")
      .select(`
        *,
        clients:client_id (id, full_name),
        assigned_user:users!internal_tasks_assigned_to_fkey (id, name, avatar_url)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Erro ao carregar tarefas");
    } else {
      setTasks((data || []) as Task[]);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .order("name");
    if (data) setUsers(data);
  };

  const handleToggleComplete = async (task: Task) => {
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
      fetchTasks();
    }
  };

  const handleDeleteTask = async () => {
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
      fetchTasks();
    }
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const openDeleteDialog = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getDueDateInfo = (task: Task) => {
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
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.clients?.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUser = filterUser === "all" || 
      filterUser === "mine" ? task.assigned_to === currentUser?.id : task.assigned_to === filterUser;

    let matchesTab = true;
    if (activeTab === "pending") {
      matchesTab = task.status === "pending" || task.status === "in_progress" || task.status === "overdue";
    } else if (activeTab === "done") {
      matchesTab = task.status === "done";
    } else if (activeTab === "cancelled") {
      matchesTab = task.status === "cancelled";
    }

    return matchesSearch && matchesUser && matchesTab;
  });

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
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
  });

  const pendingCount = tasks.filter(t => 
    t.status === "pending" || t.status === "in_progress" || t.status === "overdue"
  ).length;
  const overdueCount = tasks.filter(t => t.status === "overdue").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const doneCount = tasks.filter(t => t.status === "done").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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
                  const isCompleted = task.status === "done";
                  const isCancelled = task.status === "cancelled";
                  const isOverdue = task.status === "overdue";
                  const statusConfig = STATUS_CONFIG[task.status];
                  const StatusIcon = statusConfig.icon;
                  const priorityConfig = PRIORITY_CONFIG[task.priority];
                  const dueDateInfo = getDueDateInfo(task);

                  return (
                    <TableRow 
                      key={task.id} 
                      className={cn(
                        "hover:bg-muted/30",
                        (isCompleted || isCancelled) && "opacity-60",
                        isOverdue && "bg-destructive/5"
                      )}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isCompleted}
                          onCheckedChange={() => handleToggleComplete(task)}
                          className={cn(
                            "h-5 w-5 rounded-full border-2",
                            isCompleted && "bg-green-500 border-green-500 text-white"
                          )}
                          disabled={isCancelled}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className={cn(
                            "font-medium truncate",
                            (isCompleted || isCancelled) && "line-through text-muted-foreground"
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
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                          statusConfig.className
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{statusConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "inline-flex px-2 py-1 rounded-md text-xs font-medium",
                          priorityConfig.className
                        )}>
                          {priorityConfig.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {dueDateInfo ? (
                          <div className={cn("flex items-center justify-center gap-1 text-xs", dueDateInfo.className)}>
                            <Calendar className="h-3 w-3" />
                            <span>{dueDateInfo.text}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
          <Button 
            onClick={() => { setEditingTask(null); setDialogOpen(true); }}
            className="shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descrição ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-[160px]">
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
      </div>

      {/* Tabs & Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="pending" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="h-4 w-4" />
            Pendentes
            {pendingCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="done" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CheckCircle2 className="h-4 w-4" />
            Concluídas
            {doneCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] ml-1">
                {doneCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Canceladas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <TaskTable tasks={sortedTasks} />
        </TabsContent>

        <TabsContent value="done" className="mt-6">
          <TaskTable tasks={sortedTasks} />
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          <TaskTable tasks={sortedTasks} />
        </TabsContent>
      </Tabs>

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSuccess={fetchTasks}
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
    </div>
  );
}
