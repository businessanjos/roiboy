export type TvConn = "boa" | "instavel" | "ruim" | "offline";

export const CONN_LABEL: Record<TvConn, string> = { boa: "Conexão boa", instavel: "Conexão instável", ruim: "Conexão ruim", offline: "Offline" };

export function tvConn(status?: { connection?: string | null } | null): TvConn | null {
  const c = status?.connection;
  return c === "boa" || c === "instavel" || c === "ruim" || c === "offline" ? c : null;
}

export function connTooltip(status: any): string {
  const c = tvConn(status);
  if (!c) return "Conexão ainda não medida";
  const parts = [CONN_LABEL[c]];
  if (status.latency_ms != null) parts.push(`${status.latency_ms} ms`);
  if (status.packet_loss_pct != null) parts.push(`${status.packet_loss_pct}% perda`);
  if (status.drops_today != null) parts.push(`${status.drops_today} ${status.drops_today === 1 ? "queda" : "quedas"} hoje`);
  return parts.join(" · ");
}

export function isReleased(screen: { released_until?: string | null }, now = Date.now()) {
  return !!screen.released_until && new Date(screen.released_until).getTime() > now;
}

/** Today's switch-off time for a screen ("Até o fim do dia"); 23:59 when it has no off time. */
export function endOfDayFor(screen: any, settings: any, now = new Date()): Date {
  const hhmm: string | null =
    screen?.schedule_mode === "custom" ? screen.custom_off_time
    : screen?.schedule_mode === "global" || !screen?.schedule_mode ? settings?.off_time ?? null
    : null;
  const d = new Date(now);
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0); else d.setHours(23, 59, 0, 0);
  if (d.getTime() <= now.getTime()) d.setHours(23, 59, 0, 0);
  return d;
}

/** Transitions into "offline" within today, from oldest to newest history point. */
export function dropsToday(history: { connection: string | null; created_at: string }[], now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const out: string[] = [];
  let prev: string | null = null;
  for (const h of history) {
    if (h.connection === "offline" && prev !== "offline" && new Date(h.created_at) >= start) out.push(h.created_at);
    if (h.connection) prev = h.connection;
  }
  return out;
}
