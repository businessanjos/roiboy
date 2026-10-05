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
import { DealRulerButton } from "./DealRulerButton";
import { getDealActivityIndicator } from "@/lib/sales/dealActivityIndicator";


interface DealCardProps {
  deal: Deal;
  onClick: () => void;
  isDragging?: boolean;
  faturamentoLabel?: string;
  itemVendaLabel?: string;
  itemVendaColor?: string | null;
  activityStatus?: ActivityStatus;
  showActivityCounts?: boolean;
}

const DEFAULT_ACTIVITY_STATUS: ActivityStatus = { pendingCount: 0, hasOverdue: false, totalActivities: 0, nextDueDate: null };

export function DealCard({ deal, onClick, isDragging = false, faturamentoLabel, itemVendaLabel, itemVendaColor, activityStatus = DEFAULT_ACTIVITY_STATUS, showActivityCounts = false }: DealCardProps) {
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
        bg: 'bg-danger/20', 
        text: 'text-danger',
        isExpired: true 
      };
    } else if (daysUntilExpiry === 0) {
      return { 
        label: 'Vence hoje', 
        bg: 'bg-danger/20', 
        text: 'text-danger',
        isExpired: false 
      };
    } else {
      return { 
        label: `Vence em ${daysUntilExpiry} dias`, 
        bg: 'bg-warning/20', 
        text: 'text-warning',
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
      return { bg: 'bg-success/20', text: 'text-success', label: `Há ${daysSinceCreation} dias` };
    } else if (daysSinceCreation <= 30) {
      return { bg: 'bg-warning/20', text: 'text-warning', label: `Há ${daysSinceCreation} dias` };
    } else {
      return { bg: 'bg-danger/20', text: 'text-danger', label: `Há ${daysSinceCreation} dias` };
    }
  };

  const timeBadge = getTimeBadgeStyle();

  // Activity status indicator (vermelho atrasada / verde hoje / laranja futura / amarelo sem atividade)
  const statusIndicator = getDealActivityIndicator(activityStatus);


  return (
    <>
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative cursor-pointer hover:shadow-md transition-all duration-200 bg-card border-border/40 overflow-hidden group",
        isRenewal && "ring-1 ring-warning/40 bg-warning/5",
        (isDragging || isSortableDragging) && "opacity-30 shadow-none scale-95 border-dashed border-primary/40"
      )}
      onClick={onClick}
    >
      {/* Left color accent bar */}
      <div 
        title={statusIndicator.label}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5 rounded-l",
          statusIndicator.bgColor
        )} 
      />

      <CardContent className="pl-4 pr-3 py-3 space-y-2 sm:py-2.5 sm:space-y-1.5">
        {/* Row 1: Avatar + Name/Title + Value */}
        <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
          <div className="relative flex-shrink-0">
            <Avatar className="h-9 w-9 sm:h-7 sm:w-7 border border-border/50">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
                {getInitials(contactName)}
              </AvatarFallback>
            </Avatar>
            {deal.responsible_user && (
              <Avatar
                title={`${deal.responsible_user.name}${deal.responsible_user.is_active === false ? " (inativo)" : ""}`}
                className={`h-3.5 w-3.5 absolute -bottom-0.5 -right-0.5 border border-background ring-1 ${deal.responsible_user.is_active === false ? "ring-warning grayscale" : "ring-background"}`}>
                <AvatarImage src={deal.responsible_user.avatar_url || undefined} />
                <AvatarFallback className="text-[5px] bg-info text-white font-bold">
                  {deal.responsible_user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[15px] sm:text-xs leading-snug sm:leading-tight flex items-start sm:items-center gap-1 sm:truncate">
              <span className="line-clamp-2 break-words sm:line-clamp-none sm:truncate">{deal.title}</span>
              <VipBadge clientId={deal.client_id} />
            </h4>
            <p className="text-[13px] sm:text-[10px] text-muted-foreground truncate">{contactName}</p>
          </div>
          <span className="basis-full pl-11 text-[15px] sm:basis-auto sm:pl-0 sm:text-xs font-bold text-primary whitespace-nowrap flex-shrink-0">
            {formatCurrency(deal.value)}
          </span>
        </div>

        {/* Row 2: Renewal badge */}
        {isRenewal && (
          <div className="flex items-center gap-1 text-warning">
            <RefreshCw className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5" />
            <span className="text-xs sm:text-[9px] font-semibold uppercase tracking-wide">Renovação</span>
          </div>
        )}

        {/* 2ª Cadeira badge */}
        {(deal as any).has_second_seat && (
          <Badge variant="outline" className="text-xs sm:text-[9px] px-1.5 py-0 h-auto min-h-5 sm:h-4 whitespace-normal bg-warning/10 text-warning-strong border-warning/30 self-start">
            2ª cadeira{(deal as any).second_seat_name ? `: ${(deal as any).second_seat_name}` : ''}
          </Badge>
        )}

        {/* Row 3: Meta info line - time + contact hints */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 sm:border-0 sm:pt-0 text-xs sm:text-[10px] text-muted-foreground">
          <Badge 
            variant="secondary" 
            className={cn("text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4 font-medium", timeBadge.bg, timeBadge.text)}
          >
            {timeBadge.label}
          </Badge>
          {contactPhone && (
            <Phone className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5 flex-shrink-0" aria-label="Tem telefone" />
          )}
          {contactEmail && (
            <Mail className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5 flex-shrink-0" aria-label="Tem e-mail" />
          )}
          {/* Contract expiry inline */}
          {contractExpiry && (
            <Badge 
              variant="secondary" 
              className={cn("text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4 flex items-center gap-0.5 font-medium", contractExpiry.bg, contractExpiry.text)}
            >
              <AlertTriangle className="h-2 w-2" />
              {contractExpiry.label}
            </Badge>
          )}
        </div>

        {/* Row 4: Actions + Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0 border-t border-border/40 pt-1 sm:flex-nowrap sm:border-0 sm:pt-0 sm:overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-0.5 -ml-2 sm:ml-0">
            {/* WhatsApp */}
            {contactPhone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-5 sm:w-5 hover:bg-success/10"
                aria-label="Abrir conversa no RoyZapp"
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
                <MessageCircle className="h-5 w-5 sm:h-3 sm:w-3 text-success" />
              </Button>
            )}
            {/* Régua de relacionamento */}
            <DealRulerButton
              dealId={deal.id}
              contactName={contactName}
              contactPhone={contactPhone}
              clientId={deal.client_id}
              leadId={deal.lead_id}
              className="h-11 w-11 sm:h-5 sm:w-5"
              iconClassName="h-5 w-5 sm:h-3 sm:w-3"
            />
            {/* Activities */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-11 w-11 sm:h-5 sm:w-5 relative",
                activityStatus.pendingCount > 0 ? "hover:bg-primary/10" : "hover:bg-muted"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setActivitiesDialogOpen(true);
              }}
              title={activityStatus.pendingCount > 0 ? `${activityStatus.pendingCount} atividade(s)` : "Atividades"}
              aria-label={activityStatus.pendingCount > 0 ? `Atividades: ${activityStatus.pendingCount} pendente(s)${activityStatus.hasOverdue ? ", com atraso" : ""}` : "Atividades"}
            >
              <ListTodo className={cn(
                "h-5 w-5 sm:h-3 sm:w-3",
                activityStatus.hasOverdue ? "text-destructive" : activityStatus.pendingCount > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              {activityStatus.pendingCount > 0 && (
                <span className={cn(
                  "absolute top-1 right-1 sm:-top-1 sm:-right-1 text-[10px] sm:text-[7px] rounded-full h-4 w-4 sm:h-3 sm:w-3 flex items-center justify-center font-bold",
                  activityStatus.hasOverdue ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                )}>
                  {activityStatus.pendingCount}
                </span>
              )}
            </Button>
          </div>

          {/* Activity counts (shown when an activity-based filter is active) */}
          {showActivityCounts && (
            <div className="flex items-center gap-1 flex-wrap">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4",
                  activityStatus.pendingCount > 0
                    ? activityStatus.hasOverdue
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
                title="Atividades pendentes"
              >
                {activityStatus.pendingCount} pendente{activityStatus.pendingCount === 1 ? "" : "s"}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4 bg-muted/60 text-muted-foreground border-border"
                title="Total de atividades (histórico + em aberto)"
              >
                {activityStatus.totalActivities} total
              </Badge>
            </div>
          )}

          {/* Tags compact */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 min-w-0 flex-1 justify-end overflow-hidden">
            {faturamentoLabel && (
              <Badge variant="outline" className="text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4 bg-success/10 text-success-strong border-success/20 max-w-[140px] sm:max-w-[80px] min-w-0 shrink overflow-hidden">
                <span className="truncate">$ {faturamentoLabel}</span>
              </Badge>
            )}
            {itemVendaLabel && (
              <Badge 
                variant="outline" 
                className="text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4 max-w-[140px] sm:max-w-[80px] min-w-0 shrink overflow-hidden"
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
                <span className="truncate">{itemVendaLabel}</span>
              </Badge>
            )}

            {deal.tags
              ?.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase()))
              .slice(0, 1)
              .map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs sm:text-[9px] px-1.5 sm:px-1 py-0 h-5 sm:h-4 bg-muted/50 truncate max-w-[60px]">
                  {tag}
                </Badge>
              ))}
            {deal.tags && deal.tags.filter(tag => !['renovação', 'vencido'].includes(tag.toLowerCase())).length > 1 && (
              <span className="text-xs sm:text-[9px] text-muted-foreground">
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
