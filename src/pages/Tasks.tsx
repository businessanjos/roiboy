import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { TaskCard } from "@/components/tasks/TaskCard";
import { DraggableTaskCard } from "@/components/tasks/DraggableTaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { TaskDropZone } from "@/components/tasks/TaskDropZone";

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

type Priority = "urgent" | "high" | "medium" | "low";

export default function Tasks() {
  const { currentUser } = useCurrentUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("pending");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const newPriority = over.id as Priority;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.priority === newPriority) return;

    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, priority: newPriority } : t
    ));

    const { error } = await supabase
      .from("internal_tasks")
      .update({ priority: newPriority })
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao mover tarefa");
      fetchTasks(); // Revert on error
    } else {
      toast.success(`Prioridade alterada para ${PRIORITY_LABELS[newPriority]}`);
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

  const pendingCount = tasks.filter(t => 
    t.status === "pending" || t.status === "in_progress" || t.status === "overdue"
  ).length;
  const overdueCount = tasks.filter(t => t.status === "overdue").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const doneCount = tasks.filter(t => t.status === "done").length;

  // Group tasks by priority for pending view
  const tasksByPriority: Record<Priority, Task[]> = {
    urgent: filteredTasks.filter(t => t.priority === "urgent"),
    high: filteredTasks.filter(t => t.priority === "high"),
    medium: filteredTasks.filter(t => t.priority === "medium"),
    low: filteredTasks.filter(t => t.priority === "low"),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                  Arraste tarefas entre grupos para mudar prioridade
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
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, descrição ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-full sm:w-[220px] bg-background">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Filtrar por responsável" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
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
          </div>
        </CardContent>
      </Card>

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
          {filteredTasks.length === 0 ? (
            <EmptyState />
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                {(["urgent", "high", "medium", "low"] as Priority[]).map((priority) => (
                  <TaskDropZone
                    key={priority}
                    id={priority}
                    priority={priority}
                    tasks={tasksByPriority[priority]}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTask && (
                  <div className="opacity-90 rotate-2 scale-105">
                    <TaskCard
                      task={activeTask}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onToggleComplete={() => {}}
                      showClient={true}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>

        <TabsContent value="done" className="mt-6">
          {filteredTasks.length === 0 ? (
            <EmptyState message="Nenhuma tarefa concluída" />
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onToggleComplete={handleToggleComplete}
                  showClient={true}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-6">
          {filteredTasks.length === 0 ? (
            <EmptyState message="Nenhuma tarefa cancelada" />
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onToggleComplete={handleToggleComplete}
                  showClient={true}
                />
              ))}
            </div>
          )}
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

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

function EmptyState({ message = "Nenhuma tarefa encontrada" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <ClipboardList className="h-10 w-10 opacity-50" />
      </div>
      <p className="font-medium">{message}</p>
      <p className="text-sm mt-1">Clique em "Nova Tarefa" para começar</p>
    </div>
  );
}
