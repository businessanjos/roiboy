import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/hooks/useDeals";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Mail, Phone, Calendar, RefreshCw, AlertTriangle, ListTodo, Clock, Edit, CheckCircle } from "lucide-react";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PendingTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  assigned_to: string | null;
  custom_status?: {
    name: string;
    color: string;
    is_completed_status: boolean;
  } | null;
  assigned_user?: {
    name: string;
  } | null;
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  isDragging?: boolean;
}

export function DealCard({ deal, onClick, isDragging = false }: DealCardProps) {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [nextTaskDate, setNextTaskDate] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<PendingTask | null>(null);
  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  
  const pendingTasksCount = pendingTasks.length;
  
  // Fetch pending tasks for this deal
  useEffect(() => {
    const fetchPendingTasks = async () => {
      const { data, error } = await supabase
        .from("internal_tasks")
        .select(`
          id, 
          title,
          due_date, 
          priority,
          assigned_to,
          custom_status:task_statuses!internal_tasks_custom_status_id_fkey(name, color, is_completed_status),
          assigned_user:users!internal_tasks_assigned_to_fkey(name)
        `)
        .eq("deal_id", deal.id)
        .is("completed_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      
      if (!error && data) {
        // Filter out completed statuses
        const pending = data.filter(t => !t.custom_status?.is_completed_status) as PendingTask[];
        setPendingTasks(pending);
        
        // Find next due date
        const withDueDate = pending.filter(t => t.due_date);
        if (withDueDate.length > 0) {
          setNextTaskDate(withDueDate[0].due_date);
        } else {
          setNextTaskDate(null);
        }
      }
    };
    
    fetchPendingTasks();
    
    // Subscribe to changes
    const channel = supabase
      .channel(`deal-card-tasks-${deal.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "internal_tasks", filter: `deal_id=eq.${deal.id}` },
        () => fetchPendingTasks()
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deal.id]);

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
      toast.error("Erro ao concluir tarefa");
    } else {
      toast.success("Tarefa concluída!");
    }
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const contactName = deal.client?.full_name || deal.contact_name || 'Sem contato';
  const contactEmail = deal.client?.phone_e164 ? null : deal.contact_email;
  const contactPhone = deal.client?.phone_e164 || deal.contact_phone;
  const avatarUrl = deal.client?.avatar_url || null;

  // Check if it's a renewal deal
  const isRenewal = deal.source === 'contract_renewal' || deal.tags?.includes('renovação');

  // Calculate contract expiry info for renewal deals
  const getContractExpiryInfo = () => {
    if (!isRenewal || !deal.expected_close_date) return null;
    
    const expiryDate = new Date(deal.expected_close_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = differenceInDays(expiryDate, today);
    
    if (daysUntilExpiry < 0) {
      return { 
        label: `Vencido há ${Math.abs(daysUntilExpiry)} dias`, 
        bg: 'bg-red-500/20', 
        text: 'text-red-600',
        isExpired: true 
      };
    } else if (daysUntilExpiry === 0) {
      return { 
        label: 'Vence hoje', 
        bg: 'bg-red-500/20', 
        text: 'text-red-600',
        isExpired: false 
      };
    } else {
      return { 
        label: `Vence em ${daysUntilExpiry} dias`, 
        bg: 'bg-amber-500/20', 
        text: 'text-amber-600',
        isExpired: false 
      };
    }
  };

  const contractExpiry = getContractExpiryInfo();

  // Calculate days since creation
  const daysSinceCreation = differenceInDays(new Date(), new Date(deal.created_at));
  const createdDate = format(new Date(deal.created_at), "dd/MM/yyyy", { locale: ptBR });

  // Determine time badge color
  const getTimeBadgeStyle = () => {
    if (daysSinceCreation <= 7) {
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-600', label: `Há ${daysSinceCreation} dias` };
    } else if (daysSinceCreation <= 30) {
      return { bg: 'bg-amber-500/20', text: 'text-amber-600', label: `Há ${daysSinceCreation} dias` };
    } else {
      return { bg: 'bg-red-500/20', text: 'text-red-600', label: `Há ${daysSinceCreation} dias` };
    }
  };

  const timeBadge = getTimeBadgeStyle();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all bg-card border-border/50",
        isRenewal && "ring-2 ring-amber-500/50 bg-amber-500/5",
        (isDragging || isSortableDragging) && "opacity-50 shadow-xl rotate-1 scale-105"
      )}
      onClick={onClick}
    >
    <CardContent className="p-3 space-y-2">
        {/* Renewal Badge */}
        {isRenewal && (
          <div className="flex items-center gap-1 text-amber-600 mb-1">
            <RefreshCw className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase">Renovação</span>
          </div>
        )}

        {/* Header with Title and Client */}
        <div className="flex items-start gap-2">
          <Avatar className="h-8 w-8 border border-primary/20">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-xs truncate">{deal.title}</h4>
            <p className="text-[10px] text-muted-foreground truncate">{contactName}</p>
          </div>
        </div>

        {/* Contact Details - Compact */}
        <div className="space-y-0.5 text-[10px] text-muted-foreground">
          {contactEmail && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-2.5 w-2.5 flex-shrink-0" />
              <span className="truncate">{contactEmail}</span>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{contactPhone}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
            <span>{createdDate}</span>
          </div>
        </div>

        {/* Time Badge, Quick Task and Value - Same Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Badge 
              variant="secondary" 
              className={cn("text-[10px] px-1.5 py-0", timeBadge.bg, timeBadge.text)}
            >
              {timeBadge.label}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-5 w-5 relative",
                pendingTasksCount > 0 ? "hover:bg-primary/10" : "hover:bg-muted"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setTaskDialogOpen(true);
              }}
              title={pendingTasksCount > 0 ? `${pendingTasksCount} atividade(s) pendente(s)` : "Agendar atividade"}
            >
              <ListTodo className={cn(
                "h-3 w-3",
                pendingTasksCount > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              {pendingTasksCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold">
                  {pendingTasksCount}
                </span>
              )}
            </Button>
          </div>
          <span className="text-xs font-bold text-primary">
            {formatCurrency(deal.value)}
          </span>
        </div>

        {/* Next Task Date with Popover */}
        {pendingTasks.length > 0 && (
          <Popover open={taskPopoverOpen} onOpenChange={setTaskPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  setTaskPopoverOpen(true);
                }}
              >
                <Badge 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 flex items-center gap-1 bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 cursor-pointer transition-colors w-fit"
                >
                  <Clock className="h-2.5 w-2.5" />
                  {nextTaskDate 
                    ? `Agendado: ${format(new Date(nextTaskDate), "dd/MM 'às' HH:mm", { locale: ptBR })}`
                    : `${pendingTasks.length} atividade(s) pendente(s)`
                  }
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-72 p-0" 
              align="start"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 border-b bg-muted/30">
                <h4 className="text-xs font-semibold flex items-center gap-1.5">
                  <ListTodo className="h-3.5 w-3.5" />
                  Atividades Pendentes ({pendingTasks.length})
                </h4>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="p-2.5 hover:bg-muted/50 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{task.title}</p>
                        {task.due_date && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {format(new Date(task.due_date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        )}
                        {task.assigned_user && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {task.assigned_user.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-emerald-500/20 hover:text-emerald-600"
                          onClick={(e) => handleCompleteTask(task.id, e)}
                          title="Concluir"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-primary/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTask(task);
                            setTaskPopoverOpen(false);
                            setTaskDialogOpen(true);
                          }}
                          title="Editar"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t bg-muted/30">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(null);
                    setTaskPopoverOpen(false);
                    setTaskDialogOpen(true);
                  }}
                >
                  <ListTodo className="h-3 w-3 mr-1" />
                  Nova Atividade
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Contract Expiry Badge for Renewal Deals */}
        {contractExpiry && (
          <div className="flex items-center gap-1">
            <Badge 
              variant="secondary" 
              className={cn("text-[10px] px-1.5 py-0 flex items-center gap-1", contractExpiry.bg, contractExpiry.text)}
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {contractExpiry.label}
            </Badge>
          </div>
        )}

        {/* Tags - Only if exists (exclude renovação/vencido as they're shown above) */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.tags
              .filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase()))
              .slice(0, 2)
              .map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 bg-background"
                >
                  {tag}
                </Badge>
              ))}
            {deal.tags.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase())).length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background">
                +{deal.tags.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase())).length - 2}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask as any}
        dealId={deal.id}
        leadId={deal.lead_id || undefined}
        onSuccess={() => setEditingTask(null)}
      />
    </Card>
  );
}
