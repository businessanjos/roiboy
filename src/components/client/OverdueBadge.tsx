import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle } from "lucide-react";
import type { BatchClientFinancialStatus, FinancialRisk } from "@/hooks/useClientsFinancialStatusBatch";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const RISK: Record<Exclude<FinancialRisk, "ok">, { label: string; cls: string }> = {
  critical: { label: "Inadimplente", cls: "bg-red-600 text-white border-red-700 hover:bg-red-700" },
  high: { label: "Em atraso", cls: "bg-orange-500 text-white border-orange-600 hover:bg-orange-600" },
  warning: { label: "Vence ≤7d", cls: "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" },
};

interface Props {
  status?: BatchClientFinancialStatus;
  compact?: boolean;
}

export function OverdueBadge({ status, compact = false }: Props) {
  if (!status || status.risk === "ok") return null;
  const cfg = RISK[status.risk];

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
          {status.overdue_count > 0 ? (
            <>
              <p className="font-semibold">{status.overdue_count} parcela(s) em atraso</p>
              <p className="text-xs">Total: <strong>{fmtBRL(status.overdue_amount)}</strong></p>
              <p className="text-xs">Maior atraso: <strong>{status.oldest_overdue_days} dias</strong></p>
            </>
          ) : (
            <>
              <p className="font-semibold">Vencimento próximo</p>
              <p className="text-xs">Próximo: {status.next_due_date}</p>
              <p className="text-xs">Pendente: {fmtBRL(status.pending_amount)}</p>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
