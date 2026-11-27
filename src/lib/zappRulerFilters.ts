/**
 * Busca, filtros, ordenação e situação das atividades na tela de Réguas do RoyZapp.
 * Só organiza o que já foi carregado: não muda agendamento nem regra de envio.
 */

export type RulerPeriod = "all" | "today" | "week" | "month" | "custom";
export type RulerSort = "date_asc" | "date_desc" | "name_asc" | "name_desc";

export interface RulerFilterState {
  query: string;
  /** Nome da régua (modelo) ou "all". */
  template: string;
  period: RulerPeriod;
  /** yyyy-MM-dd, usados só em "custom". */
  from: string;
  to: string;
  sort: RulerSort;
}

export const DEFAULT_RULER_FILTERS: RulerFilterState = {
  query: "",
  template: "all",
  period: "all",
  from: "",
  to: "",
  sort: "date_asc",
};

export interface RulerContactExtra {
  emails: string[];
  phones: string[];
  names: string[];
}

interface EnrollmentLike {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  template_name: string | null;
}

interface TouchLike {
  id: string;
  status: string;
  scheduled_at: string;
}

const TZ = "America/Sao_Paulo";
const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia (yyyy-MM-dd) no horário de Brasília. */
export function rulerDayKey(value: string | Date): string {
  return dayFmt.format(typeof value === "string" ? new Date(value) : value);
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Intervalo de dias (inclusive) do período escolhido; null = todo o período. */
export function rulerPeriodRange(
  state: Pick<RulerFilterState, "period" | "from" | "to">,
  todayKey: string,
): { from: string | null; to: string | null } | null {
  switch (state.period) {
    case "today":
      return { from: todayKey, to: todayKey };
    case "week": {
      const [y, m, d] = todayKey.split("-").map(Number);
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
      const monday = addDays(todayKey, -((weekday + 6) % 7));
      return { from: monday, to: addDays(monday, 6) };
    }
    case "month": {
      const [y, m] = todayKey.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const prefix = todayKey.slice(0, 8);
      return { from: `${prefix}01`, to: `${prefix}${String(last).padStart(2, "0")}` };
    }
    case "custom":
      if (!state.from && !state.to) return null;
      return { from: state.from || null, to: state.to || null };
    default:
      return null;
  }
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Busca por nome, telefone, e-mail ou nome da régua. */
export function matchesRulerSearch(
  enrollment: EnrollmentLike,
  extra: RulerContactExtra | undefined,
  query: string,
): boolean {
  const q = normalize(query);
  if (!q) return true;

  const texts = [
    enrollment.contact_name,
    enrollment.contact_phone,
    enrollment.template_name,
    ...(extra?.names ?? []),
    ...(extra?.emails ?? []),
  ];
  if (texts.some((t) => t && normalize(t).includes(q))) return true;

  // Telefone: compara só os números, então "(51) 99547" acha "+5551995471095".
  const digits = q.replace(/\D/g, "");
  const onlyPhoneChars = /^[\d\s()+.-]+$/.test(q);
  if (onlyPhoneChars && digits.length >= 3) {
    const phones = [enrollment.contact_phone, ...(extra?.phones ?? [])];
    return phones.some((p) => p && p.replace(/\D/g, "").includes(digits));
  }
  return false;
}

/** Aplica busca, régua, período e ordenação a uma lista da tela de réguas. */
export function filterAndSortRulerRows<T>(
  rows: T[],
  read: (row: T) => { enrollment: EnrollmentLike; date: string | null },
  state: RulerFilterState,
  extras: Record<string, RulerContactExtra>,
  todayKey: string,
): T[] {
  const range = rulerPeriodRange(state, todayKey);
  const kept = rows.filter((row) => {
    const { enrollment, date } = read(row);
    if (state.template !== "all" && (enrollment.template_name || "") !== state.template) return false;
    if (range) {
      if (!date) return false;
      const key = rulerDayKey(date);
      if (range.from && key < range.from) return false;
      if (range.to && key > range.to) return false;
    }
    return matchesRulerSearch(enrollment, extras[enrollment.id], state.query);
  });

  const nameOf = (row: T) => {
    const e = read(row).enrollment;
    return normalize(e.contact_name || e.contact_phone || "");
  };
  const timeOf = (row: T) => {
    const d = read(row).date;
    return d ? new Date(d).getTime() : null;
  };

  return [...kept].sort((a, b) => {
    if (state.sort === "name_asc") return nameOf(a).localeCompare(nameOf(b), "pt-BR");
    if (state.sort === "name_desc") return nameOf(b).localeCompare(nameOf(a), "pt-BR");
    const ta = timeOf(a);
    const tb = timeOf(b);
    // Sem data sempre no fim, em qualquer direção.
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return state.sort === "date_desc" ? tb - ta : ta - tb;
  });
}

export type RulerTouchPhase = "done" | "skipped" | "current" | "pending" | "future";

export const RULER_TOUCH_PHASE_LABEL: Record<RulerTouchPhase, string> = {
  done: "Concluída",
  skipped: "Cancelada",
  current: "Atual",
  pending: "Pendente",
  future: "Futura",
};

/**
 * Situação de cada atividade da régua:
 * - concluída / cancelada: já resolvidas;
 * - atual: a próxima a ser feita (a mais antiga ainda aberta);
 * - pendente: outras que já venceram e seguem abertas;
 * - futura: ainda não chegou a data.
 */
export function rulerTouchPhases(touches: TouchLike[], now: number): Record<string, RulerTouchPhase> {
  const result: Record<string, RulerTouchPhase> = {};
  const open = touches
    .filter((t) => t.status === "pending")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const currentId = open[0]?.id;
  for (const t of touches) {
    if (t.status === "sent") result[t.id] = "done";
    else if (t.status !== "pending") result[t.id] = "skipped";
    else if (t.id === currentId) result[t.id] = "current";
    else result[t.id] = new Date(t.scheduled_at).getTime() <= now ? "pending" : "future";
  }
  return result;
}
