import { useMemo } from "react";


export interface RenewalBlockCheck {
  isBlocked: boolean;
  isLoading: boolean;
  reason: string | null;
  overdueCount: number;
  overdueAmount: number;
  maxDaysOverdue: number;
}

/**
 * DESATIVADO: o módulo financeiro ainda não é usado no ROY, então inadimplência
 * não pode bloquear renovação. Mantido o hook (mesma assinatura) retornando
 * sempre liberado. Para reativar, voltar a usar useClientFinancialStatus.
 */
export function useCanRenewClient(_clientId: string | undefined): RenewalBlockCheck {
  return useMemo(
    () => ({
      isBlocked: false,
      isLoading: false,
      reason: null,
      overdueCount: 0,
      overdueAmount: 0,
      maxDaysOverdue: 0,
    }),
    [],
  );
}

