/**
 * Calendário de feriados nacionais brasileiros (fixos + móveis baseados na Páscoa).
 * Usado para agendar toques da Régua de Relacionamento apenas em dias úteis.
 */

const FIXED_HOLIDAYS: Array<[number, number, string]> = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  [11, 20, "Consciência Negra"],
  [12, 25, "Natal"],
];

function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const cache = new Map<number, Map<string, string>>();

/** Mapa `YYYY-MM-DD` -> nome do feriado para o ano informado. */
export function getBrazilianHolidayMap(year: number): Map<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map = new Map<string, string>();
  for (const [month, day, name] of FIXED_HOLIDAYS) {
    map.set(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name);
  }
  const easter = computeEaster(year);
  map.set(dateKey(addDays(easter, -48)), "Carnaval (segunda)");
  map.set(dateKey(addDays(easter, -47)), "Carnaval (terça)");
  map.set(dateKey(addDays(easter, -2)), "Sexta-feira Santa");
  map.set(dateKey(easter), "Páscoa");
  map.set(dateKey(addDays(easter, 60)), "Corpus Christi");

  cache.set(year, map);
  return map;
}

/** Nome do feriado, se a data for feriado nacional. */
export function getHolidayName(date: Date): string | null {
  return getBrazilianHolidayMap(date.getFullYear()).get(dateKey(date)) ?? null;
}

export function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null;
}

export function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

/** Dia útil = não é sábado, domingo nem feriado nacional. */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isHoliday(date);
}

/** Empurra a data para o próximo dia útil (mantendo o horário). */
export function nextBusinessDay(date: Date): Date {
  const r = new Date(date);
  let guard = 0;
  while (!isBusinessDay(r) && guard < 30) {
    r.setDate(r.getDate() + 1);
    guard++;
  }
  return r;
}
