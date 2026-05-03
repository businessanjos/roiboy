import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Deal } from "@/hooks/useDeals";
import { useZappNavigationContext } from "@/contexts/ZappNavigationContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mail, Phone, Calendar, RefreshCw, AlertTriangle, ListTodo, MessageCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DealActivitiesDialog } from "./DealActivitiesDialog";
import { VipBadge } from "@/components/client/VipBadge";
import type { ActivityStatus } from "@/hooks/useBatchDealActivityStatus";

interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  isDragging?: boolean;
  faturamentoLabel?: string;
  itemVendaLabel?: string;
  itemVendaColor?: string | null;
  activityStatus?: ActivityStatus;
}

const DEFAULT_ACTIVITY_STATUS: ActivityStatus = { pendingCount: 0, hasOverdue: false, totalActivities: 0 };

export function DealCard({ deal, onClick, isDragging = false, faturamentoLabel, itemVendaLabel, itemVendaColor, activityStatus = DEFAULT_ACTIVITY_STATUS }: DealCardProps) {
  const [activitiesDialogOpen, setActivitiesDialogOpen] = useState(false);
  
  const { openZappConversation, loading: zappLoading } = useZappNavigationContext();
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

  // Activity status indicator
  const getActivityStatusIndicator = () => {
    // No pending activities = all done (or no activities)
    if (activityStatus.pendingCount === 0) {
      return { 
        bgColor: "bg-emerald-500", 
        textColor: "text-emerald-600", 
        label: "Feito" 
      };
    }
    
    // Has overdue activities
    if (activityStatus.hasOverdue) {
      return { 
        bgColor: "bg-red-500", 
        textColor: "text-red-600", 
        label: "Atrasado!" 
      };
    }
    
    // Has pending but none overdue
    return { 
      bgColor: "bg-amber-500", 
      textColor: "text-amber-600", 
      label: "A fazer" 
    };
  };

  const statusIndicator = getActivityStatusIndicator();

  return (
    <>
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative cursor-pointer hover:shadow-md transition-all duration-200 bg-card border-border/40 overflow-hidden group",
        isRenewal && "ring-1 ring-amber-400/40 bg-amber-500/5",
        (isDragging || isSortableDragging) && "opacity-30 shadow-none scale-95 border-dashed border-primary/40"
      )}
      onClick={onClick}
    >
      {/* Left color accent bar */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l",
          statusIndicator.bgColor
        )} 
      />

      <CardContent className="pl-4 pr-3 py-2.5 space-y-1.5">
        {/* Row 1: Avatar + Name/Title + Value */}
        <div className="flex items-start gap-2">
          <div className="relative flex-shrink-0">
            <Avatar className="h-7 w-7 border border-border/50">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                {getInitials(contactName)}
              </AvatarFallback>
            </Avatar>
            {deal.responsible_user && (
              <Avatar className="h-3.5 w-3.5 absolute -bottom-0.5 -right-0.5 border border-background ring-1 ring-background">
                <AvatarImage src={deal.responsible_user.avatar_url || undefined} />
                <AvatarFallback className="text-[5px] bg-blue-500 text-white font-bold">
                  {deal.responsible_user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-xs leading-tight truncate flex items-center gap-1">
              <span className="truncate">{deal.title}</span>
              <VipBadge clientId={deal.client_id} />
            </h4>
            <p className="text-[10px] text-muted-foreground truncate">{contactName}</p>
          </div>
          <span className="text-xs font-bold text-primary whitespace-nowrap flex-shrink-0">
            {formatCurrency(deal.value)}
          </span>
        </div>

        {/* Row 2: Renewal badge */}
        {isRenewal && (
          <div className="flex items-center gap-1 text-amber-600">
            <RefreshCw className="h-2.5 w-2.5" />
            <span className="text-[9px] font-semibold uppercase tracking-wide">Renovação</span>
          </div>
        )}

        {/* 2ª Cadeira badge */}
        {(deal as any).has_second_seat && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-700 border-amber-500/30 self-start">
            2ª cadeira{(deal as any).second_seat_name ? `: ${(deal as any).second_seat_name}` : ''}
          </Badge>
        )}

        {/* Row 3: Meta info line - time + contact hints */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Badge 
            variant="secondary" 
            className={cn("text-[9px] px-1 py-0 h-4 font-medium", timeBadge.bg, timeBadge.text)}
          >
            {timeBadge.label}
          </Badge>
          {contactPhone && (
            <Phone className="h-2.5 w-2.5 flex-shrink-0" />
          )}
          {contactEmail && (
            <Mail className="h-2.5 w-2.5 flex-shrink-0" />
          )}
          {/* Contract expiry inline */}
          {contractExpiry && (
            <Badge 
              variant="secondary" 
              className={cn("text-[9px] px-1 py-0 h-4 flex items-center gap-0.5 font-medium", contractExpiry.bg, contractExpiry.text)}
            >
              <AlertTriangle className="h-2 w-2" />
              {contractExpiry.label}
            </Badge>
          )}
        </div>

        {/* Row 4: Actions + Tags */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {/* WhatsApp */}
            {contactPhone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-emerald-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  openZappConversation({
                    phone: contactPhone,
                    clientId: deal.client_id || undefined,
                    leadId: deal.lead_id || undefined,
                    name: contactName,
                    openInNewTab: true,
                  });
                }}
                disabled={zappLoading}
                title="Abrir conversa no RoyZapp"
              >
                <MessageCircle className="h-3 w-3 text-emerald-600" />
              </Button>
            )}
            {/* Activities */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-5 w-5 relative",
                activityStatus.pendingCount > 0 ? "hover:bg-primary/10" : "hover:bg-muted"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setActivitiesDialogOpen(true);
              }}
              title={activityStatus.pendingCount > 0 ? `${activityStatus.pendingCount} atividade(s)` : "Atividades"}
            >
              <ListTodo className={cn(
                "h-3 w-3",
                activityStatus.hasOverdue ? "text-destructive" : activityStatus.pendingCount > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              {activityStatus.pendingCount > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 text-[7px] rounded-full h-3 w-3 flex items-center justify-center font-bold",
                  activityStatus.hasOverdue ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                )}>
                  {activityStatus.pendingCount}
                </span>
              )}
            </Button>
          </div>

          {/* Tags compact */}
          <div className="flex items-center gap-1 overflow-hidden">
            {faturamentoLabel && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-emerald-500/10 text-emerald-700 border-emerald-500/20 truncate max-w-[80px]">
                $ {faturamentoLabel}
              </Badge>
            )}
            {itemVendaLabel && (
              <Badge 
                variant="outline" 
                className="text-[9px] px-1 py-0 h-4 truncate max-w-[80px]"
                style={itemVendaColor ? {
                  backgroundColor: `${itemVendaColor}1A`,
                  color: itemVendaColor,
                  borderColor: `${itemVendaColor}33`,
                } : {
                  backgroundColor: 'rgb(59 130 246 / 0.1)',
                  color: 'rgb(29 78 216)',
                  borderColor: 'rgb(59 130 246 / 0.2)',
                }}
              >
                {itemVendaLabel}
              </Badge>
            )}
            {deal.tags
              ?.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase()))
              .slice(0, 1)
              .map((tag, index) => (
                <Badge key={index} variant="outline" className="text-[9px] px-1 py-0 h-4 bg-muted/50 truncate max-w-[60px]">
                  {tag}
                </Badge>
              ))}
            {deal.tags && deal.tags.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase())).length > 1 && (
              <span className="text-[9px] text-muted-foreground">
                +{deal.tags.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase())).length - 1}
              </span>
            )}
          </div>
        </div>
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
