import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { useClientFinancialStatus, ClientFinancialStatus } from "@/hooks/useClientFinancialStatus";

interface ClientFinancialStatusBadgeProps {
  clientId: string;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<ClientFinancialStatus, {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
  description: string;
}> = {
  em_dia: {
    label: "Em Dia",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20",
    description: "Cliente sem pendências financeiras",
  },
  atrasado: {
    label: "Atrasado",
    icon: AlertTriangle,
    className: "bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20",
    description: "Cliente com pagamentos em atraso (1-30 dias)",
  },
  inadimplente: {
    label: "Inadimplente",
    icon: XCircle,
    className: "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20",
    description: "Cliente com pagamentos em atraso há mais de 30 dias",
  },
  sem_dados: {
    label: "—",
    icon: CheckCircle2,
    className: "bg-muted text-muted-foreground border-border",
    description: "Sem dados financeiros",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
  lg: "text-sm px-3 py-1.5",
};

export function ClientFinancialStatusBadge({ 
  clientId, 
  showDetails = true,
  size = "md" 
}: ClientFinancialStatusBadgeProps) {
  const { status, overdueCount, overdueAmount, maxDaysOverdue, isLoading } = useClientFinancialStatus(clientId);

  if (isLoading) {
    return (
      <Badge variant="outline" className={`${sizeClasses[size]} bg-muted`}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </Badge>
    );
  }

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const badge = (
    <Badge 
      variant="outline" 
      className={`${config.className} ${sizeClasses[size]} transition-colors cursor-default`}
    >
      <StatusIcon className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} mr-1`} />
      {config.label}
    </Badge>
  );

  if (!showDetails || status === "sem_dados" || status === "em_dia") {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5">
            <p className="font-medium">{config.description}</p>
            <div className="text-xs space-y-0.5 text-muted-foreground">
              <p>• {overdueCount} título{overdueCount > 1 ? "s" : ""} em atraso</p>
              <p>• Valor total: {formatCurrency(overdueAmount)}</p>
              <p>• Maior atraso: {maxDaysOverdue} dias</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Simplified version for use in tables without individual queries
interface ClientFinancialStatusBadgeSimpleProps {
  status: ClientFinancialStatus;
  size?: "sm" | "md" | "lg";
}

export function ClientFinancialStatusBadgeSimple({ 
  status, 
  size = "md" 
}: ClientFinancialStatusBadgeSimpleProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.className} ${sizeClasses[size]} transition-colors cursor-default`}
    >
      <StatusIcon className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} mr-1`} />
      {config.label}
    </Badge>
  );
}
