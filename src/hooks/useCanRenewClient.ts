import { useMemo } from "react";
import { useClientFinancialStatus } from "./useClientFinancialStatus";

export interface RenewalBlockCheck {
  isBlocked: boolean;
  isLoading: boolean;
  reason: string | null;
  overdueCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
}

/**
 * Bloqueia renovação quando cliente está inadimplente (>30 dias em atraso).
 * Fonte única para o UI decidir se mostra o wizard ou o modal de bloqueio.
 */
export function useCanRenewClient(clientId: string | undefined): RenewalBlockCheck {
  const { status, overdueCount, overdueAmount, maxDaysOverdue, isLoading } =
    useClientFinancialStatus(clientId || "");

  return useMemo(() => {
    if (!clientId) {
      return {
        isBlocked: false,
        isLoading: false,
        reason: null,
        overdueCount: 0,
        overdueAmount: 0,
        maxDaysOverdue: 0,
      };
    }
    const isBlocked = status === "inadimplente";
    return {
      isBlocked,
      isLoading,
      reason: isBlocked
        ? `Cliente inadimplente — ${overdueCount} parcela(s) em atraso há ${maxDaysOverdue} dias.`
        : null,
      overdueCount,
      overdueAmount,
      maxDaysOverdue,
    };
  }, [clientId, status, overdueCount, overdueAmount, maxDaysOverdue, isLoading]);
}
