/**
 * Cálculo das datas dos toques da Régua de Relacionamento do RoyZapp.
 *
 * Toques são agendados a partir da data de início + offset em dias, no horário
 * escolhido pelo usuário. Nunca no passado: se a data calculada já passou, o
 * toque é empurrado para o próximo horário válido (evita disparos retroativos).
 */
export interface ScheduleStepInput {
  offset_days: number;
  title: string;
  message: string;
  sort_order: number;
}

export function computeTouchDate(startDate: string, offsetDays: number, dueTime: string): Date {
  const [h, m] = (dueTime || "09:00").split(":").map((v) => Number(v) || 0);
  const [y, mo, d] = startDate.split("-").map(Number);
  const date = new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
}

export function buildTouchRows(params: {
  enrollmentId: string;
  accountId: string;
  steps: ScheduleStepInput[];
  startDate: string;
  dueTime: string;
  autoSend: boolean;
}) {
  const now = Date.now();
  return params.steps.map((step, idx) => {
    let when = computeTouchDate(params.startDate, step.offset_days, params.dueTime);
    if (when.getTime() < now) when = new Date(now + 60 * 1000 * (idx + 1));
    return {
      enrollment_id: params.enrollmentId,
      account_id: params.accountId,
      offset_days: step.offset_days,
      sort_order: idx,
      title: step.title?.trim() || `Toque ${idx + 1}`,
      message: step.message,
      scheduled_at: when.toISOString(),
      auto_send: params.autoSend,
      status: "pending" as const,
    };
  });
}
