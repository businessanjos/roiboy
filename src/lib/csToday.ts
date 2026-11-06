/** Regras da tela "Hoje" dos Processos Eternum. Datas no fuso de São Paulo, como texto AAAA-MM-DD. */
export type TodayFilter = "onboarding" | "events" | "monthly";
export type TodayKind = "onboarding" | "wait" | "contact" | "event" | "monthly";

export interface TodayTask {
  key: string;
  kind: TodayKind;
  filter: TodayFilter;
  title: string;
  subject: string;
  processIndex: number; // 0 Onboarding, 1 Encontro Online, 2 Encontro Presencial
  due: string;
  stepKey?: string;
  clientId?: string;
  eventId?: string;
  copyText?: string;
  list?: string[];
}

export interface TaskState { task_key: string; status: "done" | "snoozed"; snooze_until: string | null }

export function spDate(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
}

export function isEncontroOnline(e: { modality: string | null; title: string }) { return e.modality === "online" && /encontro/i.test(e.title); }
export function isEncontroPresencial(e: { modality: string | null; title: string; event_type?: string | null }) {
  return e.modality === "presencial" && (/encontro|eternum|club/i.test(e.title) || e.event_type === "mentoria");
}

const ONLINE: [number, string, string][] = [
  [-15, "Avisar o grupo do encontro (15 dias antes)", "0-0"],
  [-10, "Enviar o formulário de dificuldades e o lembrete", "0-1"],
  [-3, "Cobrar quem não respondeu o formulário", "0-2"],
  [-1, "Lembrete da véspera do encontro", "0-3"],
  [0, "Mensagem do dia do encontro", "0-4"],
  [1, "Subir a gravação e avisar no grupo", "2-0"],
];
const PRESENCIAL: [number, string, string][] = [
  [-60, "Enviar o PDF informativo do encontro", "0-0"],
  [1, "Enviar a pesquisa NPS", "2-1"],
  [7, "Publicar a gravação editada na plataforma", "2-0"],
];

export function eventTasks(events: { id: string; title: string; modality: string | null; event_type?: string | null; scheduled_at: string }[]): TodayTask[] {
  const out: TodayTask[] = [];
  for (const e of events) {
    const online = isEncontroOnline(e), pres = !online && isEncontroPresencial(e);
    if (!online && !pres) continue;
    const day = spDate(new Date(e.scheduled_at));
    for (const [off, title, stepKey] of online ? ONLINE : PRESENCIAL) {
      out.push({ key: `ev:${e.id}:${off}`, kind: "event", filter: "events", title, subject: e.title, processIndex: online ? 1 : 2, due: addDays(day, off), stepKey, eventId: e.id });
    }
  }
  return out;
}

export function monthlyTasks(today: string, farFromGoal: string[]): TodayTask[] {
  const out: TodayTask[] = [];
  for (const m of [today.slice(0, 7), addDays(`${today.slice(0, 7)}-28`, 7).slice(0, 7)]) {
    const last = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    out.push({ key: `m:${m}:engage`, kind: "monthly", filter: "monthly", title: "Engajar clientes distantes da meta", subject: farFromGoal.length ? `${farFromGoal.length} clientes` : "Ciclo mensal", processIndex: 0, due: `${m}-${String(last - 6).padStart(2, "0")}`, stepKey: "2-4", list: farFromGoal });
  }
  return out;
}

export function contactTasks(today: string, rows: { client_id: string; full_name: string; last_at: string | null }[]): TodayTask[] {
  return rows.flatMap((r) => {
    const last = r.last_at ? spDate(new Date(r.last_at)) : null;
    const days = last ? daysBetween(last, today) : null;
    if (days !== null && days < 15) return [];
    return [{
      key: `c:${r.client_id}:${last ?? "nunca"}`, kind: "contact" as const, filter: "monthly" as const,
      title: days === null ? `Contato com ${r.full_name} — sem contato registrado` : `Contato com ${r.full_name} — ${days} dias sem falar`,
      subject: r.full_name, processIndex: 0, due: last ? addDays(last, 15) : today, stepKey: "2-4", clientId: r.client_id,
    }];
  });
}

export function waitReminder(firstName: string, what: string) {
  return `Oi, ${firstName}! Passando para saber se conseguiu ${what}. Qualquer dúvida estou por aqui 😊`;
}

/** Aplica concluídas/adiadas e separa em Atrasadas, Hoje e Próximos 7 dias. Eventos atrasados há mais de 7 dias saem da lista. */
export function bucketTasks(tasks: TodayTask[], states: TaskState[], today: string) {
  const st = new Map(states.map((s) => [s.task_key, s]));
  const res = { overdue: [] as TodayTask[], today: [] as TodayTask[], next: [] as TodayTask[] };
  for (const t0 of tasks) {
    const s = st.get(t0.key);
    if (s?.status === "done") continue;
    const t = s?.status === "snoozed" && s.snooze_until ? { ...t0, due: s.snooze_until } : t0;
    const d = daysBetween(today, t.due);
    if ((t.kind === "event" || t.kind === "monthly") && d < -7) continue;
    if (d < 0) res.overdue.push(t); else if (d === 0) res.today.push(t); else if (d <= 7) res.next.push(t);
  }
  for (const k of ["overdue", "today", "next"] as const) res[k].sort((a, b) => a.due.localeCompare(b.due));
  return res;
}
