import { addDays, addMonths, format, getDaysInMonth, startOfDay } from "date-fns";

export type TaskRecurrence = { frequency: "daily" | "weekly" | "monthly"; weekday?: number; month_day?: number };
export const TASK_WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function readTaskRecurrence(value: unknown): TaskRecurrence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rule = value as Record<string, unknown>;
  if (rule.frequency === "daily") return { frequency: "daily" };
  if (rule.frequency === "weekly" && Number.isInteger(rule.weekday) && Number(rule.weekday) >= 0 && Number(rule.weekday) <= 6) return { frequency: "weekly", weekday: Number(rule.weekday) };
  if (rule.frequency === "monthly" && Number.isInteger(rule.month_day) && Number(rule.month_day) >= 1 && Number(rule.month_day) <= 31) return { frequency: "monthly", month_day: Number(rule.month_day) };
  return null;
}

/** Calendar-only dates: date-fns handles month lengths without UTC conversion. */
export function recurrenceDate(rule: TaskRecurrence, from: Date, inclusive = true): Date {
  const date = startOfDay(inclusive ? from : addDays(from, 1));
  if (rule.frequency === "daily") return date;
  if (rule.frequency === "weekly") return addDays(date, ((rule.weekday ?? 1) - date.getDay() + 7) % 7);
  const monthly = (base: Date) => new Date(base.getFullYear(), base.getMonth(), Math.min(rule.month_day ?? 1, getDaysInMonth(base)));
  const candidate = monthly(date);
  return candidate >= date ? candidate : monthly(addMonths(date, 1));
}

export function recurrenceLabel(rule: TaskRecurrence): string {
  if (rule.frequency === "daily") return "Todos os dias";
  if (rule.frequency === "monthly") return `Todo mês, dia ${rule.month_day}`;
  return rule.weekday === 0 || rule.weekday === 6 ? `Todo ${TASK_WEEKDAYS[rule.weekday].toLocaleLowerCase("pt-BR")}` : `Toda ${TASK_WEEKDAYS[rule.weekday ?? 1].toLocaleLowerCase("pt-BR")}`;
}

export function recurrenceDateText(date: Date) { return format(date, "dd/MM/yyyy"); }