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
