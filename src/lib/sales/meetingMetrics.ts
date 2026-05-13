/**
 * Classificadores compartilhados para tarefas de reunião usados pelo
 * Dashboard de Vendas, Acelerômetro (CloserDashboard) e métricas por
 * vendedor (useSalesTeamMetrics). Garante que "reuniões realizadas" e
 * "no-show" tenham EXATAMENTE a mesma definição em todos os lugares.
 *
 * Regra de negócio: duas reuniões com o mesmo cliente contam como UMA
 * (dedupe por vendedor + entidade — ver `meetingEntityKey`).
 */

export type MeetingTaskKind = "held" | "noshow" | "scheduled" | "none";

export function classifyMeetingTask(
  activityName: string | null | undefined,
  title: string | null | undefined,
): MeetingTaskKind {
  const s = ((activityName || "") + " " + (title || "")).toLowerCase();
  if (!s.trim()) return "none";

  // No-show tem prioridade — uma task de "no-show" nunca conta como realizada
  if (s.includes("no-show") || s.includes("no show") || s.includes("noshow")) {
    return "noshow";
  }

  // Agendamentos (apenas marcam a agenda, não aconteceram ainda)
  if (s.includes("call comercial agendada") || s.includes("agendamento") || s.includes("agendada")) {
    return "scheduled";
  }

  // Reuniões efetivamente realizadas
  if (
    s.includes("concluída") ||
    s.includes("concluida") ||
    s.includes("realizada") ||
    s.includes("alinhamento") ||
    s.includes("reunião") ||
    s.includes("reuniao") ||
    s.includes("meeting")
  ) {
    return "held";
  }

  return "none";
}

export interface MeetingTaskLike {
  id?: string | null;
  client_id?: string | null;
  deal_id?: string | null;
  lead_id?: string | null;
}

/** Chave da entidade para dedupe (1 reunião por cliente/negócio/lead). */
export function meetingEntityKey(task: MeetingTaskLike): string {
  return (
    task.client_id ||
    task.deal_id ||
    task.lead_id ||
    task.id ||
    "unknown"
  );
}

export function meetingDedupeKey(
  assignedTo: string | null | undefined,
  task: MeetingTaskLike,
): string {
  return `${assignedTo || "unassigned"}|${meetingEntityKey(task)}`;
}
