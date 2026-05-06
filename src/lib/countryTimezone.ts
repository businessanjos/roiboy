/**
 * Mapeia código de país (ISO-2) para um timezone IANA representativo.
 * Usado para exibir o horário local do contato no RoyZapp e alertar
 * o consultor sobre fuso horário em mensagens fora de horário comercial.
 */

const COUNTRY_TZ: Record<string, string> = {
  BR: "America/Sao_Paulo",
  PT: "Europe/Lisbon",
  US: "America/New_York",
  CA: "America/Toronto",
  MX: "America/Mexico_City",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  CO: "America/Bogota",
  PE: "America/Lima",
  UY: "America/Montevideo",
  PY: "America/Asuncion",
  BO: "America/La_Paz",
  EC: "America/Guayaquil",
  VE: "America/Caracas",
  CU: "America/Havana",
  CR: "America/Costa_Rica",
  PA: "America/Panama",
  GT: "America/Guatemala",
  HN: "America/Tegucigalpa",
  SV: "America/El_Salvador",
  NI: "America/Managua",
  HT: "America/Port-au-Prince",
  BZ: "America/Belize",
  GY: "America/Guyana",
  SR: "America/Paramaribo",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  DE: "Europe/Berlin",
  IT: "Europe/Rome",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  DK: "Europe/Copenhagen",
  FI: "Europe/Helsinki",
  IS: "Atlantic/Reykjavik",
  PL: "Europe/Warsaw",
  CZ: "Europe/Prague",
  SK: "Europe/Bratislava",
  HU: "Europe/Budapest",
  RO: "Europe/Bucharest",
  BG: "Europe/Sofia",
  GR: "Europe/Athens",
  TR: "Europe/Istanbul",
  RU: "Europe/Moscow",
  UA: "Europe/Kiev",
  BY: "Europe/Minsk",
  MD: "Europe/Chisinau",
  RS: "Europe/Belgrade",
  HR: "Europe/Zagreb",
  SI: "Europe/Ljubljana",
  BA: "Europe/Sarajevo",
  MK: "Europe/Skopje",
  AL: "Europe/Tirane",
  LU: "Europe/Luxembourg",
  MT: "Europe/Malta",
  LT: "Europe/Vilnius",
  LV: "Europe/Riga",
  EE: "Europe/Tallinn",
  AD: "Europe/Andorra",
  MC: "Europe/Monaco",
  LI: "Europe/Vaduz",
  EG: "Africa/Cairo",
  ZA: "Africa/Johannesburg",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
  KW: "Asia/Kuwait",
  BH: "Asia/Bahrain",
  OM: "Asia/Muscat",
  IL: "Asia/Jerusalem",
  PS: "Asia/Gaza",
  JO: "Asia/Amman",
  LB: "Asia/Beirut",
  SY: "Asia/Damascus",
  IQ: "Asia/Baghdad",
  IR: "Asia/Tehran",
  YE: "Asia/Aden",
  AF: "Asia/Kabul",
  PK: "Asia/Karachi",
  IN: "Asia/Kolkata",
  BD: "Asia/Dhaka",
  LK: "Asia/Colombo",
  NP: "Asia/Kathmandu",
  BT: "Asia/Thimphu",
  MV: "Indian/Maldives",
  MM: "Asia/Yangon",
  TH: "Asia/Bangkok",
  VN: "Asia/Ho_Chi_Minh",
  KH: "Asia/Phnom_Penh",
  LA: "Asia/Vientiane",
  MY: "Asia/Kuala_Lumpur",
  SG: "Asia/Singapore",
  ID: "Asia/Jakarta",
  PH: "Asia/Manila",
  CN: "Asia/Shanghai",
  HK: "Asia/Hong_Kong",
  MO: "Asia/Macau",
  TW: "Asia/Taipei",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  MN: "Asia/Ulaanbaatar",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
};

export function getTimezoneForCountry(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_TZ[code.toUpperCase()] ?? null;
}

/**
 * Lista curada de fusos horários para seleção manual no perfil do cliente.
 * Cobre os 4 fusos do Brasil + principais fusos internacionais.
 * `auto` = deixa o sistema detectar pelo DDI/telefone.
 */
export interface TimezoneOption {
  value: string;
  label: string;
  group: "Brasil" | "Américas" | "Europa" | "Ásia & Oceania" | "África & Oriente Médio";
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  // Brasil — múltiplos fusos
  { value: "America/Noronha", label: "Fernando de Noronha (UTC−2)", group: "Brasil" },
  { value: "America/Sao_Paulo", label: "Brasília / SP / RJ / Sul / Nordeste (UTC−3)", group: "Brasil" },
  { value: "America/Manaus", label: "Manaus / AM / MT / MS / RO / RR (UTC−4)", group: "Brasil" },
  { value: "America/Rio_Branco", label: "Acre / Oeste do AM (UTC−5)", group: "Brasil" },
  // Américas
  { value: "America/New_York", label: "Nova York / Miami (UTC−5/−4)", group: "Américas" },
  { value: "America/Chicago", label: "Chicago / CDMX (UTC−6/−5)", group: "Américas" },
  { value: "America/Denver", label: "Denver (UTC−7/−6)", group: "Américas" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC−8/−7)", group: "Américas" },
  { value: "America/Buenos_Aires", label: "Buenos Aires / Santiago (UTC−3)", group: "Américas" },
  { value: "America/Bogota", label: "Bogotá / Lima (UTC−5)", group: "Américas" },
  { value: "America/Caracas", label: "Caracas (UTC−4)", group: "Américas" },
  { value: "America/Mexico_City", label: "Cidade do México (UTC−6)", group: "Américas" },
  // Europa
  { value: "Europe/Lisbon", label: "Lisboa / Londres (UTC+0/+1)", group: "Europa" },
  { value: "Europe/Madrid", label: "Madrid / Paris / Berlim / Roma (UTC+1/+2)", group: "Europa" },
  { value: "Europe/Athens", label: "Atenas / Istambul (UTC+2/+3)", group: "Europa" },
  { value: "Europe/Moscow", label: "Moscou (UTC+3)", group: "Europa" },
  // Ásia & Oceania
  { value: "Asia/Dubai", label: "Dubai (UTC+4)", group: "Ásia & Oceania" },
  { value: "Asia/Kolkata", label: "Índia (UTC+5:30)", group: "Ásia & Oceania" },
  { value: "Asia/Bangkok", label: "Bangkok / Jacarta (UTC+7)", group: "Ásia & Oceania" },
  { value: "Asia/Shanghai", label: "Pequim / Singapura / Hong Kong (UTC+8)", group: "Ásia & Oceania" },
  { value: "Asia/Tokyo", label: "Tóquio / Seul (UTC+9)", group: "Ásia & Oceania" },
  { value: "Australia/Sydney", label: "Sydney (UTC+10/+11)", group: "Ásia & Oceania" },
  { value: "Pacific/Auckland", label: "Nova Zelândia (UTC+12/+13)", group: "Ásia & Oceania" },
  // África & Oriente Médio
  { value: "Africa/Johannesburg", label: "Joanesburgo / Cairo (UTC+2)", group: "África & Oriente Médio" },
  { value: "Asia/Jerusalem", label: "Jerusalém (UTC+2/+3)", group: "África & Oriente Médio" },
];

export function isValidTimezone(tz: string | null | undefined): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Detecção de fuso dentro do Brasil
// ----------------------------------------------------------------------------
// O Brasil tem 4 fusos: UTC−2 (Noronha), UTC−3 (Brasília), UTC−4 (AM/MT/MS/RO/RR),
// UTC−5 (Acre + oeste do AM). DDD permite resolver corretamente em ~95% dos casos.
// Quando só temos o estado (UF), usamos como fallback.
// ============================================================================

const BR_DDD_TZ: Record<string, string> = {
  // UTC−3 — Brasília e maioria do país
  "11": "America/Sao_Paulo", "12": "America/Sao_Paulo", "13": "America/Sao_Paulo",
  "14": "America/Sao_Paulo", "15": "America/Sao_Paulo", "16": "America/Sao_Paulo",
  "17": "America/Sao_Paulo", "18": "America/Sao_Paulo", "19": "America/Sao_Paulo",
  "21": "America/Sao_Paulo", "22": "America/Sao_Paulo", "24": "America/Sao_Paulo",
  "27": "America/Sao_Paulo", "28": "America/Sao_Paulo",
  "31": "America/Sao_Paulo", "32": "America/Sao_Paulo", "33": "America/Sao_Paulo",
  "34": "America/Sao_Paulo", "35": "America/Sao_Paulo", "37": "America/Sao_Paulo",
  "38": "America/Sao_Paulo",
  "41": "America/Sao_Paulo", "42": "America/Sao_Paulo", "43": "America/Sao_Paulo",
  "44": "America/Sao_Paulo", "45": "America/Sao_Paulo", "46": "America/Sao_Paulo",
  "47": "America/Sao_Paulo", "48": "America/Sao_Paulo", "49": "America/Sao_Paulo",
  "51": "America/Sao_Paulo", "53": "America/Sao_Paulo",
  "54": "America/Sao_Paulo", "55": "America/Sao_Paulo",
  "61": "America/Sao_Paulo",
  "62": "America/Sao_Paulo", "64": "America/Sao_Paulo",
  "63": "America/Araguaina",
  "71": "America/Bahia", "73": "America/Bahia", "74": "America/Bahia",
  "75": "America/Bahia", "77": "America/Bahia",
  "79": "America/Maceio",
  "81": "America/Recife", "87": "America/Recife",
  "82": "America/Maceio",
  "83": "America/Fortaleza",
  "84": "America/Fortaleza",
  "85": "America/Fortaleza", "88": "America/Fortaleza",
  "86": "America/Fortaleza", "89": "America/Fortaleza",
  "91": "America/Belem", "93": "America/Belem", "94": "America/Belem",
  "96": "America/Belem",
  "98": "America/Fortaleza", "99": "America/Fortaleza",
  // UTC−4
  "65": "America/Cuiaba", "66": "America/Cuiaba",
  "67": "America/Campo_Grande",
  "69": "America/Porto_Velho",
  "92": "America/Manaus", "97": "America/Manaus",
  "95": "America/Boa_Vista",
  // UTC−5
  "68": "America/Rio_Branco",
};

const BR_STATE_TZ: Record<string, string> = {
  // UTC−3
  AL: "America/Maceio", BA: "America/Bahia", CE: "America/Fortaleza",
  DF: "America/Sao_Paulo", ES: "America/Sao_Paulo", GO: "America/Sao_Paulo",
  MA: "America/Fortaleza", MG: "America/Sao_Paulo", PA: "America/Belem",
  PB: "America/Fortaleza", PE: "America/Recife", PI: "America/Fortaleza",
  PR: "America/Sao_Paulo", RJ: "America/Sao_Paulo", RN: "America/Fortaleza",
  RS: "America/Sao_Paulo", SC: "America/Sao_Paulo", SE: "America/Maceio",
  SP: "America/Sao_Paulo", TO: "America/Araguaina", AP: "America/Belem",
  // UTC−4
  AM: "America/Manaus", MT: "America/Cuiaba", MS: "America/Campo_Grande",
  RO: "America/Porto_Velho", RR: "America/Boa_Vista",
  // UTC−5
  AC: "America/Rio_Branco",
};

export function getTimezoneForBrazilianDDD(ddd: string | null | undefined): string | null {
  if (!ddd) return null;
  const clean = ddd.replace(/\D/g, "").slice(0, 2);
  return BR_DDD_TZ[clean] ?? null;
}

export function getTimezoneForBrazilianState(state: string | null | undefined): string | null {
  if (!state) return null;
  return BR_STATE_TZ[state.trim().toUpperCase()] ?? null;
}

/**
 * Extrai DDD de telefone +55 em E.164 ("+55 92 99999-1234" → "92").
 * Retorna null se não for número brasileiro.
 */
export function extractBrazilianDDD(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits.startsWith("55") || digits.length < 12) return null;
  return digits.slice(2, 4);
}

export type TimezoneSource = "manual" | "ddd" | "state" | "ddi" | null;

/**
 * Resolve o melhor timezone IANA para um cliente, em ordem de prioridade:
 *   1. Override manual — sempre vence se válido.
 *   2. DDD brasileiro (telefone +55) — resolve os 4 fusos do Brasil.
 *   3. UF brasileira cadastrada — fallback quando DDD não dá.
 *   4. País detectado pelo DDI — fallback internacional.
 */
export function resolveClientTimezone(opts: {
  manualTimezone?: string | null;
  phone?: string | null;
  state?: string | null;
  countryCode?: string | null;
}): { timezone: string; source: TimezoneSource } | null {
  const { manualTimezone, phone, state, countryCode } = opts;

  if (manualTimezone && isValidTimezone(manualTimezone)) {
    return { timezone: manualTimezone, source: "manual" };
  }

  const ddd = extractBrazilianDDD(phone);
  if (ddd) {
    const tz = getTimezoneForBrazilianDDD(ddd);
    if (tz) return { timezone: tz, source: "ddd" };
  }

  const isBrazilian = (countryCode ?? "").toUpperCase() === "BR" || ddd !== null;
  if (isBrazilian) {
    const tzState = getTimezoneForBrazilianState(state);
    if (tzState) return { timezone: tzState, source: "state" };
  }

  if (countryCode) {
    const tz = getTimezoneForCountry(countryCode);
    if (tz) return { timezone: tz, source: "ddi" };
  }

  return null;
}

/**
 * Retorna a hora local atual no timezone, formato 24h "HH:mm".
 */
export function getLocalTime(timezone: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return "";
  }
}

/**
 * Retorna o offset em horas (ex.: -3, +1) entre o timezone e o horário local do navegador.
 */
export function getTimezoneOffsetHours(timezone: string, date: Date = new Date()): number | null {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const diffMs = asUtc - date.getTime();
    return Math.round(diffMs / 3_600_000);
  } catch {
    return null;
  }
}

export function formatTimezoneOffset(offset: number | null): string {
  if (offset === null || Number.isNaN(offset)) return "";
  const sign = offset >= 0 ? "+" : "−";
  return `UTC${sign}${Math.abs(offset)}`;
}

/**
 * Considera horário "inadequado" para enviar mensagens de trabalho:
 * antes das 8h ou a partir das 21h no fuso do contato.
 */
export function isOutsideBusinessHours(timezone: string, date: Date = new Date()): boolean {
  const hhmm = getLocalTime(timezone, date);
  if (!hhmm) return false;
  const hour = Number(hhmm.split(":")[0]);
  if (Number.isNaN(hour)) return false;
  return hour < 8 || hour >= 21;
}

/**
 * Retorna milissegundos até o próximo início de expediente (08:00) no fuso informado.
 * Se já estiver dentro do horário comercial, retorna 0.
 */
export function msUntilNextBusinessHour(
  timezone: string,
  date: Date = new Date(),
  startHour = 8,
): number {
  const hhmm = getLocalTime(timezone, date);
  if (!hhmm) return 0;
  const [hStr, mStr] = hhmm.split(":");
  const hour = Number(hStr);
  const minute = Number(mStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;

  // Segundos atuais no minuto local — Intl não dá; aproximamos com segundos UTC
  const seconds = date.getUTCSeconds();

  let minutesUntil: number;
  if (hour < startHour) {
    // mesmo dia, faltam (startHour - hour) horas - minutos
    minutesUntil = (startHour - hour) * 60 - minute;
  } else {
    // depois das 21h (ou >= startHour mas após 21 — só chamamos quando off-hours)
    // até meia-noite + startHour
    minutesUntil = (24 - hour) * 60 - minute + startHour * 60;
  }
  const ms = minutesUntil * 60_000 - seconds * 1000;
  return Math.max(ms, 0);
}

/**
 * Formata duração em ms como "Xh Ymin" ou "Ymin" (ou "<1min").
 */
export function formatDurationShort(ms: number): string {
  if (ms <= 0) return "<1min";
  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 1) return "<1min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
