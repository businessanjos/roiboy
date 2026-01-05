import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useTaskStatuses } from "@/hooks/useTaskStatuses";
import { useActivityTypes } from "@/hooks/useActivityTypes";
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

interface Deal {
  id: string;
  title: string;
}

interface Lead {
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
  deal_id?: string | null;
  lead_id?: string | null;
  assigned_to: string | null;
  completed_at?: string | null;
  custom_status_id?: string | null;
  activity_type_id?: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  clientId?: string;
  dealId?: string;
  leadId?: string;
  initialStatus?: string;
  onSuccess: () => void;
}

const PRIORITY_LABELS = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function TaskDialog({ open, onOpenChange, task, clientId, dealId, leadId, initialStatus, onSuccess }: TaskDialogProps) {
  const { currentUser } = useCurrentUser();
  const { hasVendasAccess } = useSectorAccess();
  const { logAudit } = useAuditLog();
  const { statuses: customStatuses } = useTaskStatuses();
  const { activityTypes } = useActivityTypes();
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    custom_status_id: "",
    priority: "medium" as Task["priority"],
    due_date: "",
    due_time: "",
    client_id: clientId || "",
    deal_id: dealId || "",
    lead_id: leadId || "",
    assigned_to: "",
    activity_type_id: "",
  });

  // Separate effect for fetching data
  useEffect(() => {
    if (open) {
      fetchUsers();
      fetchClients();
      if (hasVendasAccess) {
        fetchDeals();
        fetchLeads();
      }
    }
  }, [open, hasVendasAccess]);

  // Separate effect for initializing form data - only when dialog opens or task changes
  useEffect(() => {
    if (!open) return;
    
    if (task) {
      // Extract time from due_date if it exists and has time component
      let dueDate = "";
      let dueTime = "";
      if (task.due_date) {
        const dateObj = new Date(task.due_date);
        dueDate = task.due_date.split("T")[0];
        const hours = dateObj.getUTCHours().toString().padStart(2, "0");
        const minutes = dateObj.getUTCMinutes().toString().padStart(2, "0");
        if (hours !== "00" || minutes !== "00") {
          dueTime = `${hours}:${minutes}`;
        }
      }
      setFormData({
        title: task.title,
        description: task.description || "",
        custom_status_id: task.custom_status_id || "",
        priority: task.priority,
        due_date: dueDate,
        due_time: dueTime,
        client_id: task.client_id || "",
        deal_id: task.deal_id || "",
        lead_id: task.lead_id || "",
        assigned_to: task.assigned_to || "",
        activity_type_id: task.activity_type_id || "",
      });
    } else {
      const defaultStatusId = initialStatus || customStatuses[0]?.id || "";
      setFormData({
        title: "",
        description: "",
        custom_status_id: defaultStatusId,
        priority: "medium",
        due_date: "",
        due_time: "",
        client_id: clientId || "",
        deal_id: dealId || "",
        lead_id: leadId || "",
        assigned_to: "",
        activity_type_id: "",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, clientId, dealId, leadId, initialStatus]);

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

  const fetchDeals = async () => {
    const { data } = await supabase
      .from("deals")
      .select("id, title")
      .order("title");
    if (data) setDeals(data);
  };

  const fetchLeads = async () => {
    const { data } = await supabase
      .from("leads")
      .select("id, full_name")
      .order("full_name");
    if (data) setLeads(data);
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

      // Combine date and time
      let dueDateTime: string | null = null;
      if (formData.due_date) {
        if (formData.due_time) {
          dueDateTime = `${formData.due_date}T${formData.due_time}:00`;
        } else {
          dueDateTime = formData.due_date;
        }
      }

      if (task) {
        const updateData = {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          custom_status_id: formData.custom_status_id || null,
          priority: formData.priority,
          due_date: dueDateTime,
          client_id: formData.client_id || null,
          deal_id: formData.deal_id || null,
          lead_id: formData.lead_id || null,
          assigned_to: formData.assigned_to,
          activity_type_id: formData.activity_type_id || null,
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
          details: { custom_status_id: formData.custom_status_id, priority: formData.priority, activity_type_id: formData.activity_type_id }
        });
        
        toast.success("Tarefa atualizada!");
      } else {
        const insertData = {
          account_id: currentUser.account_id,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          custom_status_id: formData.custom_status_id || null,
          priority: formData.priority,
          due_date: dueDateTime,
          client_id: formData.client_id || null,
          deal_id: formData.deal_id || null,
          lead_id: formData.lead_id || null,
          assigned_to: formData.assigned_to,
          activity_type_id: formData.activity_type_id || null,
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

          {/* Unified linking field */}
          <div className="space-y-2">
            <Label>Vincular a (opcional)</Label>
            <Select
              value={
                formData.deal_id ? `deal:${formData.deal_id}` :
                formData.lead_id ? `lead:${formData.lead_id}` :
                formData.client_id ? `client:${formData.client_id}` :
                "none"
              }
              onValueChange={(value) => {
                if (value === "none") {
                  setFormData({ ...formData, client_id: "", deal_id: "", lead_id: "" });
                } else {
                  const [type, id] = value.split(":");
                  setFormData({
                    ...formData,
                    client_id: type === "client" ? id : "",
                    deal_id: type === "deal" ? id : "",
                    lead_id: type === "lead" ? id : "",
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione cliente, lead ou negócio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                
                {hasVendasAccess && deals.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Negócios</div>
                    {deals.map((deal) => (
                      <SelectItem key={`deal:${deal.id}`} value={`deal:${deal.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          {deal.title}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {hasVendasAccess && leads.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Leads</div>
                    {leads.map((lead) => (
                      <SelectItem key={`lead:${lead.id}`} value={`lead:${lead.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          {lead.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                
                {clients.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Clientes</div>
                    {clients.map((client) => (
                      <SelectItem key={`client:${client.id}`} value={`client:${client.id}`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {client.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {activityTypes.length > 0 && (
            <div className="space-y-2">
              <Label>Tipo de Atividade</Label>
              <Select
                value={formData.activity_type_id}
                onValueChange={(value) => setFormData({ ...formData, activity_type_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem tipo</SelectItem>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: type.color }}
                        />
                        {type.name}
                      </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Data</Label>
              <Input
                id="task-due-date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due-time">Horário</Label>
              <Input
                id="task-due-time"
                type="time"
                value={formData.due_time}
                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
              />
            </div>
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
