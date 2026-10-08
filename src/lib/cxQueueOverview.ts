import { dayKeyInTz } from "@/lib/dateUtils";

export const CX_TIME_ZONE = "America/Sao_Paulo";
export const CX_QUEUE_STATUSES = ["scheduled", "pending"];

export interface CxOverviewEvent {
  event_type: string;
  event_date: string | null;
  scheduled_send_at: string | null;
  send_status: string | null;
}

/** Display-only forecast. Never changes or reschedules an event. */
export function forecastSendAt(row: CxOverviewEvent, now: Date): string | null {
  if (row.scheduled_send_at) {
    return Number.isFinite(Date.parse(row.scheduled_send_at)) ? row.scheduled_send_at : null;
  }
  if (row.event_type !== "birthday" || !row.event_date) return null;
  const [, month, day] = row.event_date.slice(0, 10).split("-").map(Number);
  if (!month || !day || month > 12 || day > 31) return null;
  const today = dayKeyInTz(now, CX_TIME_ZONE);
  const year = Number(today.slice(0, 4));
  for (let y = year; y <= year + 4; y++) {
    const date = new Date(Date.UTC(y, month - 1, day, 11));
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) continue;
    if (dayKeyInTz(date, CX_TIME_ZONE) >= today) return date.toISOString();
  }
  return null;
}

export function buildCxOverview<T extends CxOverviewEvent>(rows: T[], horizon: number, now = new Date()) {
  const today = dayKeyInTz(now, CX_TIME_ZONE);
  const start = new Date(`${today}T12:00:00-03:00`);
  const days = Array.from({ length: horizon }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      key: dayKeyInTz(date, CX_TIME_ZONE),
      label: date.toLocaleDateString("pt-BR", { timeZone: CX_TIME_ZONE, day: "2-digit", month: "2-digit" }),
      fullLabel: date.toLocaleDateString("pt-BR", { timeZone: CX_TIME_ZONE, weekday: "long", day: "2-digit", month: "long" }),
      birthdays: 0,
      moments: 0,
    };
  });
  const byDay = new Map(days.map((day) => [day.key, day]));
  let overdue = 0, undated = 0;
  const upcoming: { row: T; at: string; estimated: boolean }[] = [];
  const queued = rows.filter((r) => CX_QUEUE_STATUSES.includes(r.send_status || ""));
  for (const row of queued) {
    const at = forecastSendAt(row, now);
    if (!at) { undated++; continue; }
    const key = dayKeyInTz(new Date(at), CX_TIME_ZONE);
    if (key < today) { overdue++; continue; }
    const day = byDay.get(key);
    if (!day) continue;
    if (row.event_type === "birthday") day.birthdays++;
    else day.moments++;
    upcoming.push({ row, at, estimated: !row.scheduled_send_at });
  }
  upcoming.sort((a, b) => a.at.localeCompare(b.at));
  const peakDays = days.filter((d) => d.birthdays > 0).sort((a, b) => b.birthdays - a.birthdays || a.key.localeCompare(b.key)).slice(0, 3);
  return {
    days, upcoming, peakDays, overdue, undated, queued: queued.length,
    today: (days[0]?.birthdays || 0) + (days[0]?.moments || 0),
    week: days.slice(0, 7).reduce((total, d) => total + d.birthdays + d.moments, 0),
    birthdays: days.reduce((total, d) => total + d.birthdays, 0),
  };
}