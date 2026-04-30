import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSectorAccess } from "@/hooks/useSectorAccess";
import { useAuditLog } from "@/hooks/useAuditLog";
import { formatLocalISOString } from "@/lib/dateUtils";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { useSector } from "@/contexts/SectorContext";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Video, ExternalLink, RefreshCw, Copy, Check, Trash2 } from "lucide-react";
import { MeetingConfigDialog } from "./MeetingConfigDialog";
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
  due_time: string | null;
  client_id: string | null;
  deal_id?: string | null;
  lead_id?: string | null;
  assigned_to: string | null;
  completed_at?: string | null;
  custom_status_id?: string | null;
  activity_type_id?: string | null;
  meeting_url?: string | null;
  meeting_platform?: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  clientId?: string;
  dealId?: string;
  leadId?: string;
  initialStatus?: string;
  initialActivityTypeId?: string;
  suggestedTitle?: string;
  forceSectorId?: string;
  onSuccess: () => void;
  onTaskCompleted?: () => void;
}

const PRIORITY_LABELS = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function TaskDialog({ open, onOpenChange, task, clientId, dealId, leadId, initialActivityTypeId, suggestedTitle, forceSectorId, onSuccess, onTaskCompleted }: TaskDialogProps) {
  const { currentUser } = useCurrentUser();
  const { hasVendasAccess } = useSectorAccess();
  const { logAudit } = useAuditLog();
  const { currentSector } = useSector();
  // Use forceSectorId if provided, otherwise use currentSector
  const effectiveSectorId = forceSectorId || currentSector?.id;
  const { activityTypes } = useActivityTypes(effectiveSectorId);
  const [isCompleted, setIsCompleted] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(task?.id || null);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(task?.meeting_url || null);
  const [meetingPlatform, setMeetingPlatform] = useState<string | null>(task?.meeting_platform || null);
  const [participantEmail, setParticipantEmail] = useState<string>("");
  const [participantName, setParticipantName] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    due_date: "",
    due_time: "",
    client_id: clientId || "",
    deal_id: dealId || "",
    lead_id: leadId || "",
    assigned_to: "",
    activity_type_id: "",
  });
  
  // Track if form was initialized for current open session
  const initializedForTaskRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

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

  // Separate effect for initializing form data - only when dialog opens
  useEffect(() => {
    // Only initialize when dialog opens (transition from closed to open)
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    
    if (!open) {
      // Reset the initialization tracker when dialog closes
      initializedForTaskRef.current = null;
      return;
    }
    
    // Create a unique key for the current task/new task scenario
    const currentTaskKey = task?.id || "new";
    
    // Skip if already initialized for this task in this open session
    if (initializedForTaskRef.current === currentTaskKey && !justOpened) {
      return;
    }
    
    initializedForTaskRef.current = currentTaskKey;
    
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        due_date: task.due_date || "",
        due_time: task.due_time ? task.due_time.slice(0, 5) : "",
        client_id: task.client_id || "",
        deal_id: task.deal_id || "",
        lead_id: task.lead_id || "",
        assigned_to: task.assigned_to || "",
        activity_type_id: task.activity_type_id || "",
      });
      setIsCompleted(!!task.completed_at);
      setCurrentTaskId(task.id);
      setMeetingUrl(task.meeting_url || null);
      setMeetingPlatform(task.meeting_platform || null);
    } else {
      // Get current date in YYYY-MM-DD format
      const now = new Date();
      const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      setFormData({
        title: suggestedTitle || "",
        description: "",
        priority: "medium",
        due_date: currentDate,
        due_time: currentTime,
        client_id: clientId || "",
        deal_id: dealId || "",
        lead_id: leadId || "",
        assigned_to: currentUser?.id || "",
        activity_type_id: initialActivityTypeId || "",
      });
      setIsCompleted(false);
      setCurrentTaskId(null);
      setMeetingUrl(null);
      setMeetingPlatform(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, clientId, dealId, leadId]);

  // Fetch lead/deal email when selected for meeting
  useEffect(() => {
    const fetchParticipantInfo = async () => {
      if (formData.lead_id) {
        const { data } = await supabase
          .from("leads")
          .select("full_name, email")
          .eq("id", formData.lead_id)
          .single();
        if (data) {
          setParticipantName(data.full_name || "");
          setParticipantEmail(data.email || "");
        }
      } else if (formData.deal_id) {
        const { data } = await supabase
          .from("deals")
          .select("title, lead_id, leads(full_name, email)")
          .eq("id", formData.deal_id)
          .single();
        if (data) {
          const lead = data.leads as any;
          setParticipantName(lead?.full_name || data.title);
          setParticipantEmail(lead?.email || "");
        }
      } else if (formData.client_id) {
        const { data } = await supabase
          .from("clients")
          .select("full_name, emails")
          .eq("id", formData.client_id)
          .single();
        if (data) {
          setParticipantName(data.full_name || "");
          const emails = data.emails as any[];
          setParticipantEmail(emails?.[0]?.email || "");
        }
      } else {
        setParticipantName("");
        setParticipantEmail("");
      }
    };
    fetchParticipantInfo();
  }, [formData.lead_id, formData.deal_id, formData.client_id]);

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
    if (!formData.activity_type_id) {
      toast.error("Selecione o tipo de atividade");
      return;
    }
    
    // Get activity type name to use as title
    const selectedActivityType = activityTypes.find(t => t.id === formData.activity_type_id);
    const taskTitle = selectedActivityType?.name || "Atividade";

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

      // Save date and time separately
      const dueDate = formData.due_date || null;
      const dueTime = formData.due_time || null;

      if (task) {
        // Sync custom_status_id with isCompleted to ensure reopening works
        let targetStatusId: string | null = task.custom_status_id || null;
        const { data: statuses } = await supabase
          .from("task_statuses")
          .select("id, is_completed_status")
          .order("display_order");
        
        if (statuses && statuses.length > 0) {
          const targetStatus = isCompleted
            ? statuses.find(s => s.is_completed_status)
            : statuses.find(s => !s.is_completed_status);
          if (targetStatus) {
            targetStatusId = targetStatus.id;
          }
        }

        const updateData = {
          title: taskTitle,
          description: formData.description.trim() || null,
          priority: formData.priority,
          due_date: dueDate,
          due_time: dueTime,
          client_id: formData.client_id || null,
          deal_id: formData.deal_id || null,
          lead_id: formData.lead_id || null,
          assigned_to: formData.assigned_to,
          activity_type_id: formData.activity_type_id || null,
          completed_at: isCompleted ? (task.completed_at || new Date().toISOString()) : null,
          custom_status_id: targetStatusId,
        };
        const { error } = await supabase
          .from("internal_tasks")
          .update(updateData)
          .eq("id", task.id);
        if (error) throw error;
        
        // Sync meeting with Google Calendar / Zoom if date/time changed
        if (task.meeting_url) {
          const dateChanged = dueDate !== (task.due_date || null);
          const timeChanged = dueTime !== (task.due_time ? task.due_time.slice(0, 5) : null);
          
          if (dateChanged || timeChanged) {
            try {
              const startDateTime = dueTime 
                ? `${dueDate}T${dueTime}:00` 
                : `${dueDate}T09:00:00`;
              const startDate = new Date(startDateTime);
              const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
              
              const { error: syncError } = await supabase.functions.invoke("update-meeting", {
                body: {
                  task_id: task.id,
                  start_time: formatLocalISOString(startDate),
                  end_time: formatLocalISOString(endDate),
                  title: taskTitle,
                },
              });
              
              if (syncError) {
                console.error("Error syncing meeting:", syncError);
              } else {
                toast.success("Calendário atualizado!");
              }
            } catch (syncErr) {
              console.error("Error syncing meeting (non-blocking):", syncErr);
            }
          }
        } else if (dueDate && formData.assigned_to) {
          // Tarefas comuns (sem Zoom/Meet): sincronizar com Google Calendar do responsável
          try {
            await supabase.functions.invoke("sync-task-calendar", {
              body: { task_id: task.id, action: "upsert" },
            });
          } catch (syncErr) {
            console.error("Error syncing task to calendar (non-blocking):", syncErr);
          }
        }
        
        logAudit({
          action: isCompleted ? "complete" : "update",
          entityType: "task",
          entityId: task.id,
          entityName: taskTitle,
          details: { priority: formData.priority, activity_type_id: formData.activity_type_id }
        });
        
        toast.success("Tarefa atualizada!");
      } else {
        const insertData = {
          account_id: currentUser.account_id,
          title: taskTitle,
          description: formData.description.trim() || null,
          priority: formData.priority,
          due_date: dueDate,
          due_time: dueTime,
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
        
        // Sync No-Show activities to Google Calendar
        if (taskTitle.toLowerCase().includes("no-show") || taskTitle.toLowerCase().includes("no show")) {
          try {
            await supabase.functions.invoke("sync-noshow-calendar", {
              body: { task_id: newTask.id, user_id: currentUser.id },
            });
          } catch (syncErr) {
            console.error("Error syncing no-show to calendar (non-blocking):", syncErr);
          }
        }
        
        logAudit({
          action: "create",
          entityType: "task",
          entityId: newTask.id,
          entityName: taskTitle,
          details: { priority: formData.priority, client_id: formData.client_id || null }
        });
        
        toast.success("Tarefa criada!");
      }

      const wasCompletedBefore = !!task?.completed_at;
      onOpenChange(false);
      onSuccess();
      if (task && isCompleted && !wasCompletedBefore) {
        onTaskCompleted?.();
      }
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

  const copyMeetingUrl = async () => {
    if (meetingUrl) {
      await navigator.clipboard.writeText(meetingUrl);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (!task?.id) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("internal_tasks")
        .delete()
        .eq("id", task.id);
        
      if (error) throw error;
      
      logAudit({
        action: "delete",
        entityType: "task",
        entityId: task.id,
        entityName: task.title,
      });
      
      toast.success("Tarefa excluída!");
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error deleting task:", error);
      toast.error(error.message || "Erro ao excluir tarefa");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Tipo de Atividade *</Label>
            <Select
              value={formData.activity_type_id}
              onValueChange={(value) => setFormData({ ...formData, activity_type_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de atividade" />
              </SelectTrigger>
              <SelectContent>
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

          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="task-completed"
              checked={isCompleted}
              onCheckedChange={(checked) => setIsCompleted(!!checked)}
            />
            <Label htmlFor="task-completed" className="cursor-pointer">
              Marcar como concluída
            </Label>
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

          {/* Meeting Button - Show for meeting/call activity types */}
          {formData.activity_type_id && activityTypes.find(t => 
            t.id === formData.activity_type_id && 
            (t.name.toLowerCase().includes("reunião") || 
             t.name.toLowerCase().includes("call") ||
             t.name.toLowerCase().includes("meet"))
          ) && (
            <div className="space-y-2">
          {meetingUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Video className="h-4 w-4 text-primary" />
                    <span className="text-sm flex-1">
                      {meetingPlatform === "zoom" ? "🔵 Zoom" : "🟢 Google Meet"} configurado
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMeetingDialogOpen(true)}
                      title="Recriar reunião"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(meetingUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={meetingUrl}
                      readOnly
                      className="text-xs font-mono bg-muted/50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyMeetingUrl}
                      title="Copiar link"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (!currentTaskId && !task) {
                      toast.error("Salve a atividade primeiro para configurar a reunião");
                      return;
                    }
                    setMeetingDialogOpen(true);
                  }}
                  disabled={!formData.due_date}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Configurar Reunião Online
                </Button>
              )}
              {!formData.due_date && (
                <p className="text-xs text-muted-foreground">
                  Defina a data para habilitar a reunião online
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            {/* Botão de excluir - só aparece em modo edição */}
            {task ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
                title="Excluir tarefa"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <div />
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {task ? "Salvar" : "Criar Tarefa"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Meeting Configuration Dialog */}
      {(currentTaskId || task?.id) && (
        <MeetingConfigDialog
          open={meetingDialogOpen}
          onOpenChange={setMeetingDialogOpen}
          taskId={currentTaskId || task?.id || ""}
          taskTitle={activityTypes.find(t => t.id === formData.activity_type_id)?.name || "Reunião"}
          dueDate={formData.due_date}
          dueTime={formData.due_time}
          participantEmail={participantEmail}
          participantName={participantName}
          leadId={formData.lead_id}
          onMeetingCreated={(url, platform) => {
            setMeetingUrl(url);
            setMeetingPlatform(platform);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa "{task?.title}" será permanentemente excluída.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
