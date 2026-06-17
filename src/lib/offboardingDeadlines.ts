import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface LegalDeadline {
  key: string;
  label: string;
  dueDate: Date;
  daysRemaining: number;
  description: string;
  severity: "ok" | "warning" | "urgent" | "overdue";
}

/**
 * Calcula prazos legais a partir da data de desligamento (TRCT, CAGED, etc.)
 * Base: CLT art. 477 §6 + Lei 4.923/65 (CAGED)
 */
export function computeLegalDeadlines(terminationDate: string | null | undefined): LegalDeadline[] {
  if (!terminationDate) return [];
  const term = new Date(terminationDate + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const trctDue = addDays(term, 10);
  const cagedDue = (() => {
    // dia 7 do mês seguinte
    const d = new Date(term);
    d.setMonth(d.getMonth() + 1);
    d.setDate(7);
    return d;
  })();
  const fgtsDue = addDays(term, 10);
  const homologacaoDue = addDays(term, 10);

  const mk = (key: string, label: string, due: Date, description: string): LegalDeadline => {
    const days = differenceInCalendarDays(due, now);
    let severity: LegalDeadline["severity"] = "ok";
    if (days < 0) severity = "overdue";
    else if (days <= 2) severity = "urgent";
    else if (days <= 5) severity = "warning";
    return { key, label, dueDate: due, daysRemaining: days, description, severity };
  };

  return [
    mk("trct", "Pagamento TRCT", trctDue, "CLT art. 477 §6 — pagamento das verbas rescisórias em até 10 dias corridos."),
    mk("fgts", "Comunicação FGTS", fgtsDue, "Depósito do FGTS rescisório + multa em até 10 dias."),
    mk("homologacao", "Homologação (se >1 ano)", homologacaoDue, "Termo de quitação assinado e entregue."),
    mk("caged", "CAGED / eSocial", cagedDue, "Comunicação de movimentação até o dia 7 do mês seguinte."),
  ];
}

export function fmtDeadline(d: Date) {
  return format(d, "dd 'de' MMM", { locale: ptBR });
}
