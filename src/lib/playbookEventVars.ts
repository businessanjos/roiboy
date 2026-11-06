/** Dados de evento configurados no item do Playbook (data, horário, link). */
export interface PlaybookEventVars {
  /** yyyy-MM-dd */
  date?: string | null;
  /** HH:mm */
  start?: string | null;
  end?: string | null;
  /** Link do encontro/formulário, trocado no dia a dia. */
  link?: string | null;
  /** Como escrever o mês (padrão: maiúsculas). */
  monthCase?: "upper" | "lower" | "title" | null;
}

export const EVENT_VARIABLES = [
  { key: "contagem_regressiva", label: "Contagem regressiva", example: "falta 1 dia" },
  { key: "data_evento", label: "Data do evento", example: "06/11" },
  { key: "dia_semana_evento", label: "Dia da semana do evento", example: "sexta-feira" },
  { key: "horario_evento", label: "Horário do evento", example: "15h às 17h" },
  { key: "mes_evento", label: "Mês do evento", example: "NOVEMBRO" },
  { key: "link_evento", label: "Link", example: "https://..." },
];

export const EVENT_VAR_PATTERN = /\{\{(contagem_regressiva|data_evento|dia_semana_evento|horario_evento|mes_evento|link_evento)\}\}/g;

export function usesEventVariables(text: string | null | undefined): boolean {
  return !!text && new RegExp(EVENT_VAR_PATTERN.source).test(text);
}

export function hasEventVarsValue(ev: PlaybookEventVars | null | undefined): boolean {
  return !!(ev?.date || ev?.link?.trim());
}

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** "Hoje" no fuso de Brasília como yyyy-MM-dd. */
function todayBR(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function hourLabel(t?: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

export function countdownText(date: string, now = new Date()): string {
  const [ty, tm, td] = todayBR(now).split("-").map(Number);
  const a = Date.UTC(ty, tm - 1, td);
  const [y, mo, d] = date.split("-").map(Number);
  const diff = Math.round((Date.UTC(y, mo - 1, d) - a) / 86400000);
  if (diff === 0) return "é hoje";
  if (diff === 1) return "falta 1 dia";
  if (diff > 1) return `faltam ${diff} dias`;
  return "já aconteceu";
}

export function buildEventVariables(ev: PlaybookEventVars | null | undefined, now = new Date()): Record<string, string> {
  const out: Record<string, string> = {};
  if (ev?.link?.trim()) out.link_evento = ev.link.trim();
  if (!ev?.date) return out;
  const [y, m, d] = ev.date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = hourLabel(ev.start), end = hourLabel(ev.end);
  return {
    ...out,
    contagem_regressiva: countdownText(ev.date, now),
    data_evento: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
    dia_semana_evento: DIAS[wd],
    horario_evento: start && end ? `${start} às ${end}` : start,
    mes_evento: caseMonth(MESES[m - 1], ev.monthCase),
  };
}

export function applyEventVariables(text: string, ev: PlaybookEventVars | null | undefined, now = new Date()): string {
  const vars = buildEventVariables(ev, now);
  return text.replace(EVENT_VAR_PATTERN, (all, k) => vars[k] ?? all);
}

function caseMonth(m: string, c?: PlaybookEventVars["monthCase"]): string {
  if (c === "lower") return m.toLowerCase();
  if (c === "title") return m.charAt(0) + m.slice(1).toLowerCase();
  return m;
}

export interface DetectedEventField {
  key: string;
  label: string;
  found: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Procura no texto escrito à mão valores que podem virar campos (data, dia da semana,
 * horário, contagem, mês, link). Devolve os trechos, o texto convertido e os valores deduzidos.
 */
export function detectEventPlaceholders(text: string, now = new Date()) {
  const fields: DetectedEventField[] = [];
  const vars: PlaybookEventVars = {};
  const repl: { re: RegExp; key: string }[] = [];
  const add = (key: string, label: string, found: string) => {
    fields.push({ key, label, found });
    repl.push({ re: new RegExp(found.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), key });
  };

  const url = text.match(/https?:\/\/[^\s)]+/);
  if (url) { vars.link = url[0]; add("link_evento", "Link", url[0]); }

  const date = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (date && Number(date[2]) >= 1 && Number(date[2]) <= 12) {
    const d = Number(date[1]), mo = Number(date[2]);
    let y = date[3] ? Number(date[3].length === 2 ? "20" + date[3] : date[3]) : Number(todayBR(now).slice(0, 4));
    const iso = (yy: number) => `${yy}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (!date[3] && iso(y) < todayBR(now)) y += 1;
    vars.date = iso(y);
    add("data_evento", "Data", date[0]);
  }

  const time = text.match(/\b(\d{1,2})h(\d{2})?\s*(?:às|as|a|-|–|até)\s*(\d{1,2})h(\d{2})?/i);
  if (time) {
    vars.start = `${time[1].padStart(2, "0")}:${time[2] || "00"}`;
    vars.end = `${time[3].padStart(2, "0")}:${time[4] || "00"}`;
    add("horario_evento", "Horário", time[0]);
  } else {
    const one = text.match(/\b(\d{1,2})h(\d{2})?\b/i);
    if (one) { vars.start = `${one[1].padStart(2, "0")}:${one[2] || "00"}`; add("horario_evento", "Horário", one[0]); }
  }

  const n = norm(text);
  const dayIdx = DIAS.findIndex((dd) => n.includes(norm(dd)) || n.includes(norm(dd.replace("-feira", " feira"))));
  if (dayIdx >= 0) {
    const nd = norm(DIAS[dayIdx]);
    const pos = n.indexOf(nd) >= 0 ? n.indexOf(nd) : n.indexOf(norm(DIAS[dayIdx].replace("-feira", " feira")));
    add("dia_semana_evento", "Dia da semana", text.substr(pos, DIAS[dayIdx].length));
  }

  const cd = text.match(/\b(faltam?\s+\d+\s+dias?|é hoje|e hoje|é amanhã)\b/i);
  if (cd) add("contagem_regressiva", "Contagem", cd[0]);

  const mIdx = MESES.findIndex((m) => new RegExp(`\\b${norm(m)}\\b`).test(n));
  if (mIdx >= 0) {
    const pos = n.search(new RegExp(`\\b${norm(MESES[mIdx])}\\b`));
    const found = text.substr(pos, MESES[mIdx].length);
    vars.monthCase = found === found.toUpperCase() ? "upper" : found === found.toLowerCase() ? "lower" : "title";
    add("mes_evento", "Mês", found);
  }

  const convert = (keys: string[]) => {
    let out = text;
    for (const r of repl) if (keys.includes(r.key)) out = out.replace(r.re, `{{${r.key}}}`);
    return out;
  };
  return { fields, vars, convert };
}
