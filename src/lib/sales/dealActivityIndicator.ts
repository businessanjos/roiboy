import { isBefore, isToday, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/dateUtils";
import type { ActivityStatus } from "@/hooks/useBatchDealActivityStatus";

/**
 * Cor do cartão no funil conforme a atividade pendente mais próxima.
 *
 * Prioridade: atrasada (vermelho) > hoje (verde) > futura (laranja) >
 * sem atividade / sem prazo (amarelo).
 */
export type DealActivityState = "overdue" | "today" | "future" | "none";

export interface DealActivityIndicator {
  state: DealActivityState;
  /** Classe de fundo da barra lateral do cartão. */
  bgColor: string;
  textColor: string;
  label: string;
}

export const DEAL_ACTIVITY_INDICATORS: Record<DealActivityState, DealActivityIndicator> = {
  overdue: { state: "overdue", bgColor: "bg-activity-overdue", textColor: "text-activity-overdue", label: "Atrasada" },
  today: { state: "today", bgColor: "bg-activity-today", textColor: "text-activity-today", label: "Hoje" },
  future: { state: "future", bgColor: "bg-activity-future", textColor: "text-activity-future", label: "Futura" },
  none: { state: "none", bgColor: "bg-activity-none", textColor: "text-activity-none", label: "Sem atividade" },
};

export function getDealActivityIndicator(status: ActivityStatus): DealActivityIndicator {
  if (!status || status.pendingCount <= 0) return DEAL_ACTIVITY_INDICATORS.none;

  const due = status.nextDueDate ? parseLocalDate(status.nextDueDate) : null;

  if (status.hasOverdue) return DEAL_ACTIVITY_INDICATORS.overdue;
  if (!due) return DEAL_ACTIVITY_INDICATORS.none;
  if (isBefore(due, startOfDay(new Date()))) return DEAL_ACTIVITY_INDICATORS.overdue;
  if (isToday(due)) return DEAL_ACTIVITY_INDICATORS.today;
  return DEAL_ACTIVITY_INDICATORS.future;
}
