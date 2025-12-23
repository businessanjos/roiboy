import { useRef, memo, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { VNPSBadge } from "@/components/ui/vnps-badge";
import { ChevronRight, MessageCircle, Wifi, WifiOff, Clock, AlertTriangle, CalendarIcon } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  full_name: string;
  phone_e164: string;
  status: string;
  avatar_url: string | null;
  responsible_user_id: string | null;
  client_products?: {
    product_id: string;
    products: { id: string; name: string } | null;
  }[];
}

interface Enrichment {
  vnps?: { vnps_score: number; vnps_class: string } | null;
  score?: { escore: number; roizometer: number; quadrant: string; trend: string } | null;
  contract?: { status: string; start_date: string | null; end_date: string | null } | null;
  whatsapp?: { hasConversation: boolean; messageCount: number; lastMessageAt: string | null } | null;
}

interface PendingForm {
  formId: string;
  formTitle: string;
  sentAt: string;
}

interface TeamUser {
  id: string;
  name: string;
  email: string;
}

interface VirtualizedClientTableProps {
  clients: Client[];
  enrichments: Record<string, Enrichment>;
  pendingFormSends: Record<string, PendingForm[]>;
  teamUsers: TeamUser[];
  maxHeight?: number;
}

const ROW_HEIGHT = 72;

const getInitials = (name: string) => {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
};

const statusLabels: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  prospect: "Prospecto",
  churned: "Churn",
  paused: "Pausado",
};

const ClientRow = memo(({ 
  client, 
  enrichment, 
  pendingForms, 
  teamUsers,
  style 
}: { 
  client: Client;
  enrichment?: Enrichment;
  pendingForms?: PendingForm[];
  teamUsers: TeamUser[];
  style: React.CSSProperties;
}) => {
  const vnps = enrichment?.vnps;
  const score = enrichment?.score;
  const contract = enrichment?.contract;
  const whatsapp = enrichment?.whatsapp;
  
  const responsibleUser = teamUsers.find(u => u.id === client.responsible_user_id);
  
  // Contract status indicator
  const getContractIndicator = () => {
    if (!contract) return null;
    const endDate = contract.end_date ? new Date(contract.end_date) : null;
    if (!endDate) return null;
    
    const daysUntilExpiry = differenceInDays(endDate, new Date());
    
    if (daysUntilExpiry < 0) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </TooltipTrigger>
          <TooltipContent>Contrato expirado</TooltipContent>
        </Tooltip>
      );
    }
    if (daysUntilExpiry <= 30) {
      return (
        <Tooltip>
          <TooltipTrigger>
            <Clock className="h-4 w-4 text-amber-500" />
          </TooltipTrigger>
          <TooltipContent>Expira em {daysUntilExpiry} dias</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger>
          <CalendarIcon className="h-4 w-4 text-green-500" />
        </TooltipTrigger>
        <TooltipContent>
          Até {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div 
      style={style}
      className="flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors"
    >
      {/* Avatar + Name */}
      <div className="flex items-center gap-3 min-w-[250px] flex-1">
        <Avatar className="h-10 w-10">
          <AvatarImage src={client.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
            {getInitials(client.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <Link 
            to={`/clients/${client.id}`}
            className="font-medium text-foreground hover:text-primary transition-colors block truncate"
          >
            {client.full_name}
          </Link>
          <p className="text-xs text-muted-foreground truncate">{client.phone_e164}</p>
        </div>
      </div>

      {/* Status */}
      <div className="w-24">
        <StatusIndicator status={client.status as any} size="sm" />
      </div>

      {/* V-NPS */}
      <div className="w-20 text-center">
        {vnps ? (
          <VNPSBadge score={vnps.vnps_score} vnpsClass={vnps.vnps_class as "detractor" | "neutral" | "promoter"} size="sm" showTrend={false} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* E-Score */}
      <div className="w-20 text-center">
        {score ? (
          <span className={cn(
            "text-sm font-medium",
            score.escore >= 70 ? "text-green-600" :
            score.escore >= 40 ? "text-amber-600" : "text-red-600"
          )}>
            {score.escore}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Contract */}
      <div className="w-16 flex justify-center">
        <TooltipProvider>
          {getContractIndicator() || <span className="text-xs text-muted-foreground">—</span>}
        </TooltipProvider>
      </div>

      {/* WhatsApp */}
      <div className="w-16 flex justify-center">
        <TooltipProvider>
          {whatsapp?.hasConversation ? (
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1">
                  <Wifi className="h-4 w-4 text-green-500" />
                  {whatsapp.messageCount > 0 && (
                    <span className="text-xs text-muted-foreground">{whatsapp.messageCount}</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {whatsapp.messageCount} mensagens
                {whatsapp.lastMessageAt && (
                  <div className="text-xs opacity-70">
                    Última: {format(new Date(whatsapp.lastMessageAt), "dd/MM HH:mm")}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <WifiOff className="h-4 w-4 text-muted-foreground/50" />
          )}
        </TooltipProvider>
      </div>

      {/* Responsible */}
      <div className="w-28 truncate">
        {responsibleUser ? (
          <span className="text-xs text-muted-foreground">{responsibleUser.name.split(" ")[0]}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Pending Forms */}
      <div className="w-16 flex justify-center">
        {pendingForms && pendingForms.length > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs">
                  {pendingForms.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {pendingForms.map(f => f.formTitle).join(", ")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>

      {/* Action */}
      <div className="w-10">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to={`/clients/${client.id}`}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
});

ClientRow.displayName = "ClientRow";

export function VirtualizedClientTable({
  clients,
  enrichments,
  pendingFormSends,
  teamUsers,
  maxHeight = 600,
}: VirtualizedClientTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: clients.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum cliente encontrado
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b font-medium text-sm text-muted-foreground">
        <div className="min-w-[250px] flex-1">Cliente</div>
        <div className="w-24">Status</div>
        <div className="w-20 text-center">V-NPS</div>
        <div className="w-20 text-center">E-Score</div>
        <div className="w-16 text-center">Contrato</div>
        <div className="w-16 text-center">WhatsApp</div>
        <div className="w-28">Responsável</div>
        <div className="w-16 text-center">Forms</div>
        <div className="w-10"></div>
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: Math.min(clients.length * ROW_HEIGHT, maxHeight) }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const client = clients[virtualRow.index];
            return (
              <ClientRow
                key={client.id}
                client={client}
                enrichment={enrichments[client.id]}
                pendingForms={pendingFormSends[client.id]}
                teamUsers={teamUsers}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Footer with count */}
      <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
        {clients.length} cliente{clients.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
