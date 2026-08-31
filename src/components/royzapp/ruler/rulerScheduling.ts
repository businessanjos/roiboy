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

  // Se a data de início já passou, deslocamos a cadência INTEIRA em dias inteiros,
  // preservando o espaçamento entre os toques (D+1 e D+2 nunca caem no mesmo dia).
  let shiftDays = 0;
  for (const step of params.steps) {
    const base = computeTouchDate(params.startDate, step.offset_days, params.dueTime, false);
    if (base.getTime() >= now) continue;
    const diffMs = now - base.getTime();
    const needed = Math.ceil(diffMs / 86_400_000);
    if (needed > shiftDays) shiftDays = needed;
  }

  // Garante um dia distinto por toque: se o ajuste de fim de semana/feriado
  // empurrar dois toques para o mesmo dia, o seguinte vai para o próximo dia útil.
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  let lastDay = 0;

  return params.steps.map((step, idx) => {
    let when = computeTouchDate(
      params.startDate,
      step.offset_days + shiftDays,
      params.dueTime,
      params.skipWeekends,
    );
    while (lastDay && dayStart(when) <= lastDay) {
      when = new Date(when.getTime() + 86_400_000);
      if (params.skipWeekends) when = shiftToWeekday(when);
    }
    lastDay = dayStart(when);

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


