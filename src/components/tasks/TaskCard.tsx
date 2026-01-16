import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Calendar, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  User2,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { useZappNavigation } from "@/hooks/useZappNavigation";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dateUtils";

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
  due_time: string | null;
  client_id: string | null;
  deal_id?: string | null;
  assigned_to: string | null;
  created_at: string;
  clients?: Client | null;
  deals?: { 
    id: string; 
    title: string;
    client_id: string | null;
    lead_id: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    client?: { id: string; full_name: string; phone_e164: string } | null;
    lead?: { id: string; full_name: string; phone: string | null } | null;
  } | null;
  assigned_user?: User | null;
  activity_type?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
}

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  showClient?: boolean;
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, className: "bg-muted text-muted-foreground" },
  done: { label: "Feita", icon: CheckCircle2, className: "bg-green-500/10 text-green-600 dark:text-green-400" },
  overdue: { label: "Atrasada", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
};

// Compute status based on completed_at and due_date
const getComputedStatus = (task: { completed_at?: string | null; due_date: string | null }): "pending" | "done" | "overdue" => {
  if (task.completed_at) return "done";
  
  if (task.due_date) {
    const dueDate = parseLocalDate(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate && dueDate < today) return "overdue";
  }
  
  return "pending";
};

export function TaskCard({ task, onEdit, onDelete, onToggleComplete, showClient = true }: TaskCardProps) {
  const navigate = useNavigate();
  const { openZappConversation, loading: zappLoading, PinDialog, InstanceSelectorDialog } = useZappNavigation();
  
  // Compute status automatically
  const computedStatus = getComputedStatus(task);
  const statusConfig = STATUS_CONFIG[computedStatus];
  const StatusIcon = statusConfig.icon;
  const isCompleted = computedStatus === "done";
  const isOverdue = computedStatus === "overdue";

  const getDueDateInfo = () => {
    if (!task.due_date) return null;
    const dueDate = parseLocalDate(task.due_date);
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysDiff = differenceInDays(dueDate, today);
    const formattedDate = format(dueDate, "dd/MM", { locale: ptBR });
    
    if (isCompleted) {
      return { text: formattedDate, className: "text-muted-foreground", urgent: false };
    }
    
    if (daysDiff < 0) {
      return { text: `${Math.abs(daysDiff)}d atrasado · ${formattedDate}`, className: "text-destructive font-medium", urgent: true };
    }
    if (daysDiff === 0) {
      return { text: `Hoje · ${formattedDate}`, className: "text-amber-600 dark:text-amber-400 font-medium", urgent: true };
    }
    if (daysDiff === 1) {
      return { text: `Amanhã · ${formattedDate}`, className: "text-amber-600 dark:text-amber-400", urgent: false };
    }
    if (daysDiff <= 7) {
      return { text: `${daysDiff} dias · ${formattedDate}`, className: "text-foreground", urgent: false };
    }
    return { text: formattedDate, className: "text-muted-foreground", urgent: false };
  };

  const dueDateInfo = getDueDateInfo();

  const getContactInfoFromTask = () => {
    if (!task.deals) return null;
    
    const deal = task.deals;
    const phone = deal.client?.phone_e164 || deal.lead?.phone || deal.contact_phone;
    const name = deal.client?.full_name || deal.lead?.full_name || deal.contact_name;
    const clientId = deal.client_id || undefined;
    const leadId = deal.lead_id || undefined;
    
    if (!phone) return null;
    
    return { phone, name, clientId, leadId };
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-4 p-4 rounded-xl border bg-card transition-all duration-200",
        "hover:shadow-md hover:border-primary/20",
        isCompleted && "opacity-60 hover:opacity-80",
        isOverdue && "border-destructive/30 bg-destructive/5"
      )}
    >
      {/* Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => onToggleComplete(task)}
          className={cn(
            "h-4 w-4 rounded-full border transition-colors",
            isCompleted ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground/40"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium leading-tight",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {task.activity_type?.name || task.title}
            </p>
            {task.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(() => {
                const contactInfo = getContactInfoFromTask();
                if (!contactInfo) return null;
                return (
                  <DropdownMenuItem
                    onClick={() => openZappConversation({
                      phone: contactInfo.phone,
                      clientId: contactInfo.clientId,
                      leadId: contactInfo.leadId,
                      name: contactInfo.name || undefined,
                    })}
                    className="text-emerald-600 dark:text-emerald-400"
                    disabled={zappLoading}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Conversar
                  </DropdownMenuItem>
                );
              })()}
              {task.deals && task.deal_id && (
                <DropdownMenuItem 
                  onClick={() => navigate(`/pipeline?deal=${task.deal_id}`)}
                  className="text-blue-600 dark:text-blue-400"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Ver Negócio
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(task)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status badge (read-only, computed automatically) */}
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
            statusConfig.className
          )}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{statusConfig.label}</span>
          </div>

          {/* Due date */}
          {dueDateInfo && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs",
              dueDateInfo.className
            )}>
              <Calendar className="h-3.5 w-3.5" />
              <span>{dueDateInfo.text}</span>
            </div>
          )}

          {/* Client */}
          {showClient && task.clients && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User2 className="h-3.5 w-3.5" />
              <span className="truncate max-w-[140px]">{task.clients.full_name}</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Assigned user */}
          {task.assigned_user && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background shadow-sm">
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
          )}
        </div>
      </div>
      
      {/* Dialogs for WhatsApp instance selection and PIN */}
      {InstanceSelectorDialog}
      {PinDialog}
    </div>
  );
}
