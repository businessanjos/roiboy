/** Dados de evento configurados no item do Playbook (data, horário). */
export interface PlaybookEventVars {
  /** yyyy-MM-dd */
  date?: string | null;
  /** HH:mm */
  start?: string | null;
  end?: string | null;
}

export const EVENT_VARIABLES = [
  { key: "contagem_regressiva", label: "Contagem regressiva", example: "falta 1 dia" },
  { key: "data_evento", label: "Data do evento", example: "06/11" },
  { key: "dia_semana_evento", label: "Dia da semana do evento", example: "sexta-feira" },
  { key: "horario_evento", label: "Horário do evento", example: "15h às 17h" },
  { key: "mes_evento", label: "Mês do evento", example: "NOVEMBRO" },
];

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
  const a = Date.UTC(...(todayBR(now).split("-").map(Number) as [number, number, number]));
  const [y, mo, d] = date.split("-").map(Number);
  const diff = Math.round((Date.UTC(y, mo - 1, d) - a) / 86400000);
  if (diff === 0) return "é hoje";
  if (diff === 1) return "falta 1 dia";
  if (diff > 1) return `faltam ${diff} dias`;
  return "já aconteceu";
}

export function buildEventVariables(ev: PlaybookEventVars | null | undefined, now = new Date()): Record<string, string> {
  if (!ev?.date) return {};
  const [y, m, d] = ev.date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const start = hourLabel(ev.start), end = hourLabel(ev.end);
  return {
    contagem_regressiva: countdownText(ev.date, now),
    data_evento: `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
    dia_semana_evento: DIAS[wd],
    horario_evento: start && end ? `${start} às ${end}` : start,
    mes_evento: MESES[m - 1],
  };
}

export function applyEventVariables(text: string, ev: PlaybookEventVars | null | undefined, now = new Date()): string {
  const vars = buildEventVariables(ev, now);
  return text.replace(/\{\{(contagem_regressiva|data_evento|dia_semana_evento|horario_evento|mes_evento)\}\}/g, (all, k) => vars[k] ?? all);
}
