/**
 * Resolve a moeda (ISO 4217) e o locale do cliente a partir do país (ISO-2)
 * com fallback no DDI do telefone E.164.
 *
 * Usado em telas como Fichas (Formulário) para formatar valores monetários
 * automaticamente conforme o país do cliente.
 */

// Mapa país (ISO-2) -> { currency, locale }
const COUNTRY_MAP: Record<string, { currency: string; locale: string; name: string }> = {
  BR: { currency: "BRL", locale: "pt-BR", name: "Brasil" },
  US: { currency: "USD", locale: "en-US", name: "Estados Unidos" },
  PT: { currency: "EUR", locale: "pt-PT", name: "Portugal" },
  ES: { currency: "EUR", locale: "es-ES", name: "Espanha" },
  FR: { currency: "EUR", locale: "fr-FR", name: "França" },
  DE: { currency: "EUR", locale: "de-DE", name: "Alemanha" },
  IT: { currency: "EUR", locale: "it-IT", name: "Itália" },
  GB: { currency: "GBP", locale: "en-GB", name: "Reino Unido" },
  CA: { currency: "CAD", locale: "en-CA", name: "Canadá" },
  MX: { currency: "MXN", locale: "es-MX", name: "México" },
  AR: { currency: "ARS", locale: "es-AR", name: "Argentina" },
  CL: { currency: "CLP", locale: "es-CL", name: "Chile" },
  CO: { currency: "COP", locale: "es-CO", name: "Colômbia" },
  UY: { currency: "UYU", locale: "es-UY", name: "Uruguai" },
  PY: { currency: "PYG", locale: "es-PY", name: "Paraguai" },
  PE: { currency: "PEN", locale: "es-PE", name: "Peru" },
  AU: { currency: "AUD", locale: "en-AU", name: "Austrália" },
  JP: { currency: "JPY", locale: "ja-JP", name: "Japão" },
  CN: { currency: "CNY", locale: "zh-CN", name: "China" },
  CH: { currency: "CHF", locale: "de-CH", name: "Suíça" },
  AO: { currency: "AOA", locale: "pt-AO", name: "Angola" },
  MZ: { currency: "MZN", locale: "pt-MZ", name: "Moçambique" },
};

// DDI (E.164 prefix) -> ISO-2. Maior prefixo primeiro na lookup.
const DDI_TO_COUNTRY: Array<[string, string]> = [
  ["55", "BR"],
  ["1", "US"],   // também CA — assumimos US por padrão
  ["351", "PT"],
  ["34", "ES"],
  ["33", "FR"],
  ["49", "DE"],
  ["39", "IT"],
  ["44", "GB"],
  ["52", "MX"],
  ["54", "AR"],
  ["56", "CL"],
  ["57", "CO"],
  ["598", "UY"],
  ["595", "PY"],
  ["51", "PE"],
  ["61", "AU"],
  ["81", "JP"],
  ["86", "CN"],
  ["41", "CH"],
  ["244", "AO"],
  ["258", "MZ"],
];

export function countryFromPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  // Ordena por prefixo mais longo para evitar conflitos (ex.: 55 antes de 5)
  const sorted = [...DDI_TO_COUNTRY].sort((a, b) => b[0].length - a[0].length);
  for (const [ddi, iso] of sorted) {
    if (digits.startsWith(ddi)) return iso;
  }
  return null;
}

export interface ClientLocale {
  country: string;       // ISO-2 (default 'BR')
  currency: string;      // ISO 4217 (default 'BRL')
  locale: string;        // BCP-47 (default 'pt-BR')
  countryName: string;
  inferred: boolean;     // true se foi deduzido pelo DDI
}

export function resolveClientLocale(opts: {
  country?: string | null;
  phone?: string | null;
}): ClientLocale {
  const explicit = (opts.country || "").trim().toUpperCase();
  let iso = explicit && COUNTRY_MAP[explicit] ? explicit : null;
  let inferred = false;

  if (!iso) {
    const fromPhone = countryFromPhone(opts.phone);
    if (fromPhone) {
      iso = fromPhone;
      inferred = true;
    }
  }

  const final = iso || "BR";
  const meta = COUNTRY_MAP[final] || COUNTRY_MAP.BR;
  return {
    country: final,
    currency: meta.currency,
    locale: meta.locale,
    countryName: meta.name,
    inferred,
  };
}

/**
 * Normaliza um valor textual/numérico (digitado em pt-BR ou en-US) para Number.
 * Heurística:
 *  - Se houver vírgula E ponto, o último símbolo é o separador decimal.
 *  - Se só houver vírgula, ela é o decimal (pt-BR).
 *  - Se só houver ponto, é o decimal (en-US).
 */
export function parseNumeric(value: any): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return NaN;
  const raw = String(value).replace(/[^\d.,-]/g, "").trim();
  if (!raw) return NaN;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");
  let normalized = raw;
  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function formatCurrencyForLocale(value: any, locale: ClientLocale): string {
  const n = parseNumeric(value);
  if (!Number.isFinite(n)) return String(value ?? "—");
  try {
    return n.toLocaleString(locale.locale, {
      style: "currency",
      currency: locale.currency,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${locale.currency} ${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
}
