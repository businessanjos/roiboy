/**
 * Fonte única de verdade para o status efetivo de um evento.
 *
 * O banco persiste o status ("completed" é gravado automaticamente por trigger
 * + rotina horária quando a data final passa). Esta função é apenas a rede de
 * segurança para o intervalo entre o fim do evento e a próxima execução da
 * rotina, garantindo que lista, Kanban, KPIs anuais e a tela de detalhe
 * mostrem exatamente o mesmo status.
 */
export type EffectiveEventStatus = "completed" | "cancelled" | "open";

export interface EventStatusInput {
  status?: string | null;
  scheduled_at?: string | null;
  ends_at?: string | null;
}

export function isEventPast(event: EventStatusInput, now: Date = new Date()): boolean {
  const raw = event.ends_at || event.scheduled_at;
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < now.getTime();
}

export function resolveEventStatus(
  event: EventStatusInput,
  now: Date = new Date(),
): EffectiveEventStatus {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "completed") return "completed";
  return isEventPast(event, now) ? "completed" : "open";
}

export function isEventCompleted(event: EventStatusInput, now?: Date): boolean {
  return resolveEventStatus(event, now) === "completed";
}

export function isEventLocked(event: EventStatusInput, now?: Date): boolean {
  return resolveEventStatus(event, now) !== "open";
}
