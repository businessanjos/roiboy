import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  completed_at?: string | null;
  custom_status_id?: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  clientId?: string;
  initialStatus?: string; // Now it's the custom_status_id
  onSuccess: () => void;
}

const PRIORITY_LABELS = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function TaskDialog({ open, onOpenChange, task, clientId, initialStatus, onSuccess }: TaskDialogProps) {
  const { currentUser } = useCurrentUser();
  const { logAudit } = useAuditLog();
  const { statuses: customStatuses } = useTaskStatuses();
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    custom_status_id: "",
    priority: "medium" as Task["priority"],
    due_date: "",
    client_id: clientId || "",
    assigned_to: "",
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (!clientId) {
        fetchClients();
      }
      if (task) {
        setFormData({
          title: task.title,
          description: task.description || "",
          custom_status_id: task.custom_status_id || "",
          priority: task.priority,
          due_date: task.due_date || "",
          client_id: task.client_id || "",
          assigned_to: task.assigned_to || "",
        });
      } else {
        const defaultStatusId = initialStatus || customStatuses[0]?.id || "";
        setFormData({
          title: "",
          description: "",
          custom_status_id: defaultStatusId,
          priority: "medium",
          due_date: "",
          client_id: clientId || "",
          assigned_to: "",
        });
      }
    }
  }, [open, task, clientId, initialStatus, customStatuses]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url")
      .order("name");
    if (data) setUsers(data);
  };

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name")
      .order("full_name");
    if (data) setClients(data);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Preencha o título da tarefa");
      return;
    }

    if (!formData.assigned_to) {
      toast.error("Selecione o responsável");
      return;
    }

    setSubmitting(true);

    try {
      if (!currentUser?.account_id || !currentUser?.id) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      // Check if selected status is a completed status
      const selectedStatus = customStatuses.find(s => s.id === formData.custom_status_id);
      const isCompleted = selectedStatus?.is_completed_status || false;

      if (task) {
        const updateData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          custom_status_id: formData.custom_status_id || null,
          priority: formData.priority,
          due_date: formData.due_date || null,
          client_id: formData.client_id || null,
          assigned_to: formData.assigned_to,
          completed_at: isCompleted && !task.completed_at 
            ? new Date().toISOString() 
            : !isCompleted ? null : task.completed_at,
        };
        const { error } = await supabase
          .from("internal_tasks")
          .update(updateData)
          .eq("id", task.id);
        if (error) throw error;
        
        logAudit({
          action: isCompleted ? "complete" : "update",
          entityType: "task",
          entityId: task.id,
          entityName: formData.title.trim(),
          details: { custom_status_id: formData.custom_status_id, priority: formData.priority }
        });
        
        toast.success("Tarefa atualizada!");
      } else {
        const insertData = {
          account_id: currentUser.account_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          custom_status_id: formData.custom_status_id || null,
          priority: formData.priority,
          due_date: formData.due_date || null,
          client_id: formData.client_id || null,
          assigned_to: formData.assigned_to,
          created_by: currentUser.id,
          completed_at: isCompleted ? new Date().toISOString() : null,
        };
        const { data: newTask, error } = await supabase
          .from("internal_tasks")
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;
        
        logAudit({
          action: "create",
          entityType: "task",
          entityId: newTask.id,
          entityName: formData.title.trim(),
          details: { custom_status_id: formData.custom_status_id, priority: formData.priority, client_id: formData.client_id || null }
        });
        
        toast.success("Tarefa criada!");
      }

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error saving task:", error);
      toast.error(error.message || "Erro ao salvar tarefa");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="O que precisa ser feito?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes adicionais..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Responsável *</Label>
            <Select
              value={formData.assigned_to}
              onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
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

          {!clientId && (
            <div className="space-y-2">
              <Label>Cliente (opcional)</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: Task["priority"]) => 
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.custom_status_id}
                onValueChange={(value) => 
                  setFormData({ ...formData, custom_status_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {customStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-due-date">Data Limite</Label>
            <Input
              id="task-due-date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Salvar" : "Criar Tarefa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
