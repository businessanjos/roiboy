import { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/hooks/useDeals";
import { useZappNavigation } from "@/hooks/useZappNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mail, Phone, Calendar, RefreshCw, AlertTriangle, ListTodo, MessageCircle } from "lucide-react";
import { format, differenceInDays, startOfDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DealActivitiesDialog } from "./DealActivitiesDialog";
import { supabase } from "@/integrations/supabase/client";

interface PendingTaskCount {
  count: number;
  hasOverdue: boolean;
}

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  isDragging?: boolean;
}

export function DealCard({ deal, onClick, isDragging = false }: DealCardProps) {
  const [activitiesDialogOpen, setActivitiesDialogOpen] = useState(false);
  const [pendingTasksInfo, setPendingTasksInfo] = useState<PendingTaskCount>({ count: 0, hasOverdue: false });
  
  const { openZappConversation, loading: zappLoading } = useZappNavigation();
  
  // Fetch pending tasks count and overdue status for this deal
  useEffect(() => {
    const fetchPendingTasksInfo = async () => {
      const { data, error } = await supabase
        .from("internal_tasks")
        .select(`
          id, 
          due_date,
          completed_at,
          custom_status:task_statuses!internal_tasks_custom_status_id_fkey(is_completed_status)
        `)
        .eq("deal_id", deal.id)
        .is("completed_at", null);
      
      if (!error && data) {
        // Filter out completed statuses
        const pending = data.filter(t => !t.custom_status?.is_completed_status);
        
        // Check for overdue tasks
        const today = startOfDay(new Date());
        const hasOverdue = pending.some(t => {
          if (!t.due_date) return false;
          const dueDate = startOfDay(new Date(t.due_date + 'T00:00:00'));
          return isBefore(dueDate, today);
        });
        
        setPendingTasksInfo({ count: pending.length, hasOverdue });
      }
    };
    
    fetchPendingTasksInfo();
    
    // Subscribe to changes
    const channel = supabase
      .channel(`deal-card-tasks-${deal.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "internal_tasks", filter: `deal_id=eq.${deal.id}` },
        () => fetchPendingTasksInfo()
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [deal.id]);
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

  const contactName = deal.client?.full_name || deal.lead?.full_name || deal.contact_name || 'Sem contato';
  const contactEmail = deal.client?.phone_e164 ? null : (deal.lead?.email || deal.contact_email);
  const contactPhone = deal.client?.phone_e164 || deal.lead?.phone || deal.contact_phone;
  const avatarUrl = deal.client?.avatar_url || deal.lead?.avatar_url || null;

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
    <>
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
          <div className="relative">
            <Avatar className="h-8 w-8 border border-primary/20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                {getInitials(contactName)}
              </AvatarFallback>
            </Avatar>
            {/* Owner avatar overlay */}
            {deal.responsible_user && (
              <Avatar className="h-4 w-4 absolute -bottom-0.5 -right-0.5 border border-background ring-1 ring-background">
                <AvatarImage src={deal.responsible_user.avatar_url || undefined} />
                <AvatarFallback className="text-[6px] bg-blue-500 text-white font-bold">
                  {deal.responsible_user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
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

        {/* Time Badge, Quick Actions and Value - Same Row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <Badge 
              variant="secondary" 
              className={cn("text-[10px] px-1.5 py-0", timeBadge.bg, timeBadge.text)}
            >
              {timeBadge.label}
            </Badge>
            {/* WhatsApp Button */}
            {contactPhone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-emerald-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  openZappConversation({
                    phone: contactPhone,
                    clientId: deal.client_id || undefined,
                    leadId: deal.lead_id || undefined,
                    name: contactName,
                  });
                }}
                disabled={zappLoading}
                title="Abrir conversa no RoyZapp"
              >
                <MessageCircle className="h-3 w-3 text-emerald-600" />
              </Button>
            )}
            {/* Activities Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-5 w-5 relative",
                pendingTasksInfo.count > 0 ? "hover:bg-primary/10" : "hover:bg-muted"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setActivitiesDialogOpen(true);
              }}
              title={pendingTasksInfo.count > 0 ? `${pendingTasksInfo.count} atividade(s)` : "Atividades"}
            >
              <ListTodo className={cn(
                "h-3 w-3",
                pendingTasksInfo.hasOverdue ? "text-destructive" : pendingTasksInfo.count > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              {pendingTasksInfo.count > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 text-[8px] rounded-full h-3.5 w-3.5 flex items-center justify-center font-bold",
                  pendingTasksInfo.hasOverdue ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                )}>
                  {pendingTasksInfo.count}
                </span>
              )}
            </Button>
          </div>
          <span className="text-xs font-bold text-primary">
            {formatCurrency(deal.value)}
          </span>
        </div>

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
    </Card>

    <DealActivitiesDialog
      open={activitiesDialogOpen}
      onOpenChange={setActivitiesDialogOpen}
      dealId={deal.id}
      leadId={deal.lead_id || undefined}
    />
  </>
  );
}
