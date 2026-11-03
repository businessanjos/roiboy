/**
 * Return path from an event detail page back to the screen that opened it.
 *
 * KPIs Anuais links carry a snapshot (year, filters, open list) so the detail
 * page's back control restores the same view instead of dropping the user on
 * the plain events list. Snapshots are pure reads of history state: applying
 * them twice must not change anything.
 */

export const EVENT_KPIS_URL = "/events/kpis";
export const EVENT_KPIS_LABEL = "KPIs Anuais";

export type EventKpisDetailKind = "events" | "realized" | "participants" | "budget" | "actual";

const DETAIL_KINDS: readonly string[] = ["events", "realized", "participants", "budget", "actual"];

export interface EventKpisSnapshot {
  year: number;
  modality: string;
  type: string;
  status: string;
  detail: EventKpisDetailKind | null;
}

export interface EventDetailReturn {
  url: string;
  label: string;
  kpis: EventKpisSnapshot;
}

function readSnapshot(value: unknown): EventKpisSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.year !== "number" || !Number.isFinite(raw.year)) return null;
  const text = (v: unknown) => (typeof v === "string" && v ? v : "all");
  const detail = DETAIL_KINDS.includes(raw.detail as string) ? (raw.detail as EventKpisDetailKind) : null;
  return { year: Math.trunc(raw.year), modality: text(raw.modality), type: text(raw.type), status: text(raw.status), detail };
}

/** State attached to the event detail entry so it can offer a way back. */
export function buildEventDetailReturnState(kpis: EventKpisSnapshot): { eventDetailReturn: EventDetailReturn } {
  return { eventDetailReturn: { url: EVENT_KPIS_URL, label: EVENT_KPIS_LABEL, kpis } };
}

/** Return target stored by the link that opened the event detail. */
export function getEventDetailReturn(state: unknown): EventDetailReturn | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as Record<string, unknown>).eventDetailReturn;
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (candidate.url !== EVENT_KPIS_URL || typeof candidate.label !== "string" || !candidate.label) return null;
  const kpis = readSnapshot(candidate.kpis);
  return kpis ? { url: EVENT_KPIS_URL, label: candidate.label, kpis } : null;
}

/** State attached to the KPIs entry so it restores the same view on return. */
export function buildEventKpisEntryState(kpis: EventKpisSnapshot): { eventKpisEntry: EventKpisSnapshot } {
  return { eventKpisEntry: kpis };
}

/** Snapshot to restore on the KPIs page, or null when the entry carries none. */
export function getEventKpisEntry(state: unknown): EventKpisSnapshot | null {
  if (!state || typeof state !== "object") return null;
  return readSnapshot((state as Record<string, unknown>).eventKpisEntry);
}
