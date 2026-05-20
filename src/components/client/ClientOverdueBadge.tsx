import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";
import { useClientFinancialStatus } from "@/hooks/useClientFinancialStatus";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  clientId: string;
  compact?: boolean;
}

/**
 * Badge de inadimplência para a ficha individual do cliente.
 * Usa o mesmo hook que a página /clients para manter consistência.
 */
export function ClientOverdueBadge({ clientId, compact = false }: Props) {
  const { status, overdueCount, overdueAmount, maxDaysOverdue, isLoading } =
    useClientFinancialStatus(clientId);

  if (isLoading || status === "em_dia" || status === "sem_dados") return null;

  const cfg =
    status === "inadimplente"
      ? { label: "Inadimplente", cls: "bg-red-600 text-white border-red-700 hover:bg-red-700" }
      : { label: "Em atraso", cls: "bg-orange-500 text-white border-orange-600 hover:bg-orange-600" };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`text-[10px] font-semibold ${cfg.cls} flex items-center gap-1 cursor-default`}>
            <AlertTriangle className="h-3 w-3" />
            {compact ? "" : cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs space-y-1">
          <p className="font-semibold">{overdueCount} parcela(s) em atraso</p>
          <p className="text-xs">
            Total: <strong>{fmtBRL(overdueAmount)}</strong>
          </p>
          <p className="text-xs">
            Maior atraso: <strong>{maxDaysOverdue} dias</strong>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
