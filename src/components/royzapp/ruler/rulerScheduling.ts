import { nextBusinessDay } from "@/lib/brazilianHolidays";
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
  /** Toque apenas de atividade: nunca envia mensagem, vira tarefa manual. */
  is_task?: boolean;
}


/** Empurra sábado/domingo/feriado nacional para o próximo dia útil. */
export function shiftToWeekday(date: Date): Date {
  return nextBusinessDay(date);
}

export function computeTouchDate(
  startDate: string,
  offsetDays: number,
  dueTime: string,
  skipWeekends = false,
): Date {
  const [h, m] = (dueTime || "09:00").split(":").map((v) => Number(v) || 0);
  const [y, mo, d] = startDate.split("-").map(Number);
  const date = new Date(y, (mo || 1) - 1, d || 1, h, m, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return skipWeekends ? shiftToWeekday(date) : date;
}


export function buildTouchRows(params: {
  enrollmentId: string;
  accountId: string;
  steps: ScheduleStepInput[];
  startDate: string;
  dueTime: string;
  autoSend: boolean;
  /** Se true, toques que caírem no fim de semana vão para a segunda seguinte. */
  skipWeekends?: boolean;
}) {
  const now = Date.now();
  return params.steps.map((step, idx) => {
    let when = computeTouchDate(params.startDate, step.offset_days, params.dueTime, params.skipWeekends);
    if (when.getTime() < now) {
      when = new Date(now + 60 * 1000 * (idx + 1));
      if (params.skipWeekends) when = shiftToWeekday(when);
    }
    const isTask = !!step.is_task;
    return {
      enrollment_id: params.enrollmentId,
      account_id: params.accountId,
      offset_days: step.offset_days,
      sort_order: idx,
      title: step.title?.trim() || `Toque ${idx + 1}`,
      message: isTask ? "" : step.message,
      is_task: isTask,
      scheduled_at: when.toISOString(),
      auto_send: isTask ? false : params.autoSend,
      status: "pending" as const,
    };
  });
}

