import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Plus, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";

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

interface ClientTasksProps {
  clientId: string;
}

export function ClientTasks({ clientId }: ClientTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`client-tasks-${clientId}`)
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "internal_tasks",
          filter: `client_id=eq.${clientId}`
        },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("internal_tasks")
      .select(`
        *,
        clients:client_id (id, full_name),
        assigned_user:users!internal_tasks_assigned_to_fkey (id, name, avatar_url)
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
    } else {
      setTasks((data || []) as Task[]);
    }
    setLoading(false);
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

  const pendingTasks = tasks.filter(t => 
    t.status === "pending" || t.status === "in_progress" || t.status === "overdue"
  );
  const completedTasks = tasks.filter(t => t.status === "done" || t.status === "cancelled");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Tarefas do Cliente
        </h3>
        <Button 
          size="sm" 
          onClick={() => { setEditingTask(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova Tarefa
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma tarefa vinculada a este cliente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Pendentes ({pendingTasks.length})
              </p>
              {pendingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onToggleComplete={handleToggleComplete}
                  showClient={false}
                />
              ))}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Concluídas ({completedTasks.length})
              </p>
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onToggleComplete={handleToggleComplete}
                  showClient={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        clientId={clientId}
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
