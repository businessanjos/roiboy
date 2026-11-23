// Pure office-hours countdown (America/Sao_Paulo, fixed UTC-3 since 2019).
// Mirrors the TV agent's order: keep_off > keep_on > holiday > weekday > on/off window.
export interface OfficeSettings {
  days?: number[] | null; holidays?: string[] | null;
  on_time?: string | null; off_time?: string | null;
  keep_on_until?: string | null; keep_off_until?: string | null;
}
export type OffReason = "keep_off" | "keep_on" | "holiday" | "weekday" | "hours";
export interface OfficeState { on: boolean; reason: OffReason }
export interface Countdown {
  on: boolean; reason: OffReason;
  target: number | null; // ms epoch of next change, null = sem previsão
  periodStart: number | null;
  label: string; // "Hoje às 19:30" | "Sem previsão de ligar"
  why: string | null;
}

const OFFSET = 3 * 3600_000; // SP = UTC-3
const DAY = 86400_000;
const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WD_CAP = WD.map((w) => w[0].toUpperCase() + w.slice(1));
const pad = (n: number) => String(n).padStart(2, "0");

/** Local SP parts for an epoch. */
export function spParts(t: number) {
  const d = new Date(t - OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const isoDay = (t: number) => { const p = spParts(t); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
/** Epoch of SP midnight of the day containing t. */
const spMidnight = (t: number) => Math.floor((t - OFFSET) / DAY) * DAY + OFFSET;
const hm = (s: string | null | undefined, def: number) => { if (!s) return def; const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const ts = (s?: string | null) => (s ? new Date(s).getTime() : NaN);

export function stateAt(s: OfficeSettings, t: number): OfficeState {
  const off = ts(s.keep_off_until); if (off > t) return { on: false, reason: "keep_off" };
  const on = ts(s.keep_on_until); if (on > t) return { on: true, reason: "keep_on" };
  if ((s.holidays ?? []).includes(isoDay(t))) return { on: false, reason: "holiday" };
  const p = spParts(t);
  if (!(s.days ?? []).includes(p.wd)) return { on: false, reason: "weekday" };
  const a = hm(s.on_time, 470), b = hm(s.off_time, 1170);
  return { on: p.min >= a && p.min < b, reason: "hours" };
}

function boundaries(s: OfficeSettings, from: number, dir: 1 | -1): number[] {
  const out: number[] = [];
  const a = hm(s.on_time, 470) * 60_000, b = hm(s.off_time, 1170) * 60_000;
  const m0 = spMidnight(from);
  for (let i = 0; i <= 61; i++) { const m = m0 + dir * i * DAY; out.push(m, m + a, m + b); }
  for (const x of [ts(s.keep_off_until), ts(s.keep_on_until)]) if (!isNaN(x)) out.push(x);
  return out.filter((x) => (dir === 1 ? x > from : x <= from)).sort((x, y) => dir * (x - y));
}

export function dayLabel(target: number, now: number): string {
  const diff = Math.round((spMidnight(target) - spMidnight(now)) / DAY);
  const p = spParts(target);
  const time = `${pad(Math.floor(p.min / 60))}:${pad(p.min % 60)}`;
  if (diff === 0) return `Hoje às ${time}`;
  if (diff === 1) return `Amanhã às ${time}`;
  if (diff < 7) return `${WD_CAP[p.wd]} às ${time}`;
  return `${WD_CAP[p.wd]}, ${pad(p.d)}/${pad(p.m)} às ${time}`;
}
export function shortDay(target: number, now: number): string {
  const diff = Math.round((spMidnight(target) - spMidnight(now)) / DAY);
  if (diff === 0) return "hoje"; if (diff === 1) return "amanhã";
  const p = spParts(target); return diff < 7 ? WD[p.wd] : `${pad(p.d)}/${pad(p.m)}`;
}
export const timeOf = (t: number) => { const p = spParts(t); return `${pad(Math.floor(p.min / 60))}:${pad(p.min % 60)}`; };

function whyText(s: OfficeSettings, cur: OfficeState, now: number, target: number | null): string | null {
  if (cur.reason === "keep_on") return `exceção: ligadas até ${timeOf(ts(s.keep_on_until))}`;
  if (cur.reason === "keep_off") return "desligadas por férias/manutenção";
  if (cur.on || target == null) return null;
  // Days skipped between today and the target day (exclusive) plus today if it had no window.
  const hol: number[] = [], wk: number[] = [];
  for (let m = spMidnight(now); m < spMidnight(target); m += DAY) {
    const st = stateAt({ ...s, keep_on_until: null, keep_off_until: null }, m + 12 * 3600_000);
    if (st.reason === "holiday") hol.push(m); else if (st.reason === "weekday") wk.push(m);
  }
  if (hol.length) { const p = spParts(hol[0]); return `${WD[p.wd]} (${pad(p.d)}/${pad(p.m)}) é feriado`; }
  if (wk.length) {
    const names = Array.from(new Set(wk.map((m) => WD[spParts(m).wd])));
    if (names.length === 2 && names.includes("sábado") && names.includes("domingo")) return "sábado e domingo sem expediente";
    return `${names.join(" e ")} sem expediente`;
  }
  return null;
}

export function computeCountdown(s: OfficeSettings | null | undefined, now: number): Countdown {
  const set = s ?? {};
  const cur = stateAt(set, now);
  const same = (t: number) => stateAt(set, t).on === cur.on;
  const target = boundaries(set, now, 1).find((t) => !same(t)) ?? null;
  // Period start: earliest moment going backwards before which the state differed.
  let periodStart: number | null = null;
  for (const t of boundaries(set, now, -1)) { if (stateAt(set, t - 1).on !== cur.on) { periodStart = t; break; } }
  return {
    on: cur.on, reason: cur.reason, target, periodStart,
    label: target == null ? (cur.on ? "Sem previsão de desligar" : "Sem previsão de ligar") : dayLabel(target, now),
    why: whyText(set, cur, now, target),
  };
}

export function splitRemaining(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}
export function fmtRemaining(ms: number) {
  const r = splitRemaining(ms); const core = `${pad(r.h)}:${pad(r.m)}:${pad(r.s)}`;
  return r.d > 0 ? `${r.d}d ${core}` : core;
}
export const progressOf = (c: Countdown, now: number) =>
  c.target == null || c.periodStart == null ? 0 : Math.min(1, Math.max(0, (now - c.periodStart) / (c.target - c.periodStart)));
export const isFinalStretch = (c: Countdown, now: number) => c.on && c.target != null && c.target - now <= 15 * 60_000;
/** New keep_on_until for "Estender 1h": the off moment (already the exception when active) + 1h. */
export const extendOneHour = (c: Countdown) => (c.target == null ? null : new Date(c.target + 3600_000).toISOString());
export const AGENT_STALE_MS = 3 * 60_000;
export function lastAgentSync(status: { last_seen?: string | null }[] = []) {
  const last = Math.max(0, ...status.map((x) => (x.last_seen ? new Date(x.last_seen).getTime() : 0)));
  return last || null;
}
export const ownScheduleCount = (screens: { schedule_mode?: string | null }[] = []) =>
  screens.filter((x) => x.schedule_mode && x.schedule_mode !== "global").length;
