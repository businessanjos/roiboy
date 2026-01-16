import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Filter } from "lucide-react";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import MarketingTaskSection from "./MarketingTaskSection";
import { toast } from "sonner";

interface MarketingTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  due_time: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  custom_status_id: string | null;
  activity_type_id: string | null;
  assigned_user: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  custom_status: {
    id: string;
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  activity_type: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface User {
  id: string;
  name: string;
  avatar_url: string | null;
}

// Default marketing sections when no activity types exist
const DEFAULT_SECTIONS = [
  { id: "campaigns", name: "Campanhas" },
  { id: "content", name: "Conteúdo" },
  { id: "social", name: "Redes Sociais" },
  { id: "events", name: "Eventos" },
  { id: "other", name: "Outros" },
];

export default function MarketingTasksTab() {
  const { currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"section" | "assignee" | "priority">("section");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MarketingTask | null>(null);
  const [selectedActivityTypeId, setSelectedActivityTypeId] = useState<string | undefined>();

  // Fetch all tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["marketing-tasks"],
    queryFn: async () => {
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
          assigned_to,
          completed_at,
          custom_status_id,
          activity_type_id,
          assigned_user:users!internal_tasks_assigned_to_fkey(id, name, avatar_url),
          custom_status:task_statuses!internal_tasks_custom_status_id_fkey(id, name, color, is_completed_status),
          activity_type:activity_types!internal_tasks_activity_type_id_fkey(id, name, color)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as MarketingTask[];
    },
    staleTime: 30000,
  });

  // Fetch users for filter
  const { data: users = [] } = useQuery({
    queryKey: ["team-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, name, avatar_url")
        .order("name");
      if (error) throw error;
      return data as User[];
    },
  });

  // Fetch activity types for sections
  const { data: activityTypes = [] } = useQuery({
    queryKey: ["activity-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_types")
        .select("id, name, color")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Toggle task completion
  const toggleComplete = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const { error } = await supabase
        .from("internal_tasks")
        .update({
          completed_at: isCompleted ? null : new Date().toISOString(),
        })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
    },
    onError: () => {
      toast.error("Erro ao atualizar tarefa");
    },
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = 
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.description?.toLowerCase().includes(search.toLowerCase());
      
      const matchesUser = 
        filterUser === "all" || 
        (filterUser === "mine" && task.assigned_to === currentUser?.id) ||
        task.assigned_to === filterUser;
      
      const matchesPriority = 
        filterPriority === "all" || task.priority === filterPriority;

      return matchesSearch && matchesUser && matchesPriority;
    });
  }, [tasks, search, filterUser, filterPriority, currentUser?.id]);

  // Group tasks by section/activity type
  const groupedTasks = useMemo(() => {
    if (groupBy === "assignee") {
      const groups: Record<string, MarketingTask[]> = { "Não atribuído": [] };
      users.forEach(u => { groups[u.name] = []; });
      
      filteredTasks.forEach(task => {
        const key = task.assigned_user?.name || "Não atribuído";
        if (!groups[key]) groups[key] = [];
        groups[key].push(task);
      });
      
      return Object.entries(groups)
        .filter(([_, tasks]) => tasks.length > 0)
        .map(([name, tasks]) => ({ id: name, name, color: null, tasks }));
    }
    
    if (groupBy === "priority") {
      const priorityOrder = ["urgent", "high", "medium", "low"];
      const priorityLabels: Record<string, string> = {
        urgent: "Urgente",
        high: "Alta",
        medium: "Média",
        low: "Baixa",
      };
      
      return priorityOrder.map(priority => ({
        id: priority,
        name: priorityLabels[priority],
        color: null,
        tasks: filteredTasks.filter(t => t.priority === priority),
      })).filter(g => g.tasks.length > 0);
    }

    // Default: group by activity type
    const sections = activityTypes.length > 0 
      ? activityTypes.map(at => ({ id: at.id, name: at.name, color: at.color }))
      : DEFAULT_SECTIONS.map(s => ({ ...s, color: null }));

    const grouped = sections.map(section => ({
      ...section,
      tasks: filteredTasks.filter(task => 
        activityTypes.length > 0 
          ? task.activity_type_id === section.id
          : !task.activity_type_id
      ),
    }));

    // Add "Sem tipo" section for tasks without activity type
    const untyped = filteredTasks.filter(t => !t.activity_type_id);
    if (untyped.length > 0 && activityTypes.length > 0) {
      grouped.push({ id: "untyped", name: "Sem tipo", color: null, tasks: untyped });
    }

    return grouped.filter(g => g.tasks.length > 0 || activityTypes.some(at => at.id === g.id));
  }, [filteredTasks, activityTypes, users, groupBy]);

  const handleAddTask = (activityTypeId?: string) => {
    setSelectedTask(null);
    setSelectedActivityTypeId(activityTypeId);
    setDialogOpen(true);
  };

  const handleEditTask = (task: MarketingTask) => {
    setSelectedTask(task);
    setSelectedActivityTypeId(undefined);
    setDialogOpen(true);
  };

  const handleToggleComplete = (task: MarketingTask) => {
    toggleComplete.mutate({
      taskId: task.id,
      isCompleted: !!task.completed_at,
    });
  };

  const handleDialogSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["internal-tasks"] });
  };

  const hasActiveFilters = filterUser !== "all" || filterPriority !== "all";

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => handleAddTask()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar tarefa
          </Button>
          
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="mine">Minhas tarefas</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterUser("all");
                setFilterPriority("all");
              }}
              className="text-muted-foreground"
            >
              <Filter className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Agrupar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="section">Por tipo</SelectItem>
            <SelectItem value="assignee">Por responsável</SelectItem>
            <SelectItem value="priority">Por prioridade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task sections */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {groupedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma tarefa encontrada</p>
              <Button 
                variant="link" 
                onClick={() => handleAddTask()}
                className="mt-2"
              >
                Criar primeira tarefa
              </Button>
            </div>
          ) : (
            groupedTasks.map((section) => (
              <MarketingTaskSection
                key={section.id}
                id={section.id}
                name={section.name}
                color={section.color}
                tasks={section.tasks}
                onAddTask={() => handleAddTask(
                  activityTypes.some(at => at.id === section.id) ? section.id : undefined
                )}
                onEditTask={handleEditTask}
                onToggleComplete={handleToggleComplete}
              />
            ))
          )}
        </div>
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={selectedTask as any}
        initialActivityTypeId={selectedActivityTypeId}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
