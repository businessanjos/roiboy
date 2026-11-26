/**
 * Mentoria Ao Vivo: uma única fonte de registros (`ec_mentoring_attendance`),
 * lida pela tela "Mentoria Ao Vivo" e pela Agenda de Entregas do cliente.
 * Data depois de hoje = agendada; hoje ou antes = realizada (entregue).
 */
export type MentoringSessionStatus = "scheduled" | "done";

export interface MentoringSession {
  id: string;
  client_id: string;
  session_date: string; // yyyy-MM-dd
  notes: string | null;
}

export function mentoringSessionStatus(sessionDate: string, today: string): MentoringSessionStatus {
  return sessionDate > today ? "scheduled" : "done";
}

/** Agendadas primeiro (da mais próxima para a mais distante), depois realizadas (da mais recente para a mais antiga). */
export function orderMentoringSessions<T extends { session_date: string }>(rows: T[], today: string): T[] {
  const scheduled = rows
    .filter((r) => mentoringSessionStatus(r.session_date, today) === "scheduled")
    .sort((a, b) => a.session_date.localeCompare(b.session_date));
  const done = rows
    .filter((r) => mentoringSessionStatus(r.session_date, today) === "done")
    .sort((a, b) => b.session_date.localeCompare(a.session_date));
  return [...scheduled, ...done];
}
