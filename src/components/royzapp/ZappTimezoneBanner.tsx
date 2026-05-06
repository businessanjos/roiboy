import { memo, useEffect, useState } from "react";
import { Clock, Globe2, AlertTriangle, Pin, Wand2 } from "lucide-react";
import { getCountryFromPhone } from "@/lib/phoneCountry";
import { getFlagColors } from "@/lib/countryFlagColors";
import {
  formatDurationShort,
  formatTimezoneOffset,
  getLocalTime,
  getTimezoneOffsetHours,
  isOutsideBusinessHours,
  msUntilNextBusinessHour,
  resolveClientTimezone,
  type TimezoneSource,
} from "@/lib/countryTimezone";

interface ZappTimezoneBannerProps {
  phone: string | null | undefined;
  /**
   * Override manual de fuso horário (IANA) vindo do cadastro do cliente.
   * Quando presente, sempre tem prioridade sobre a detecção automática.
   */
  clientTimezone?: string | null;
  /** UF cadastrada (BR), usada como fallback quando DDD não resolve. */
  clientState?: string | null;
}

/**
 * Banner exibido quando o cliente está em fuso diferente do horário de Brasília
 * (UTC−3). Cobre tanto clientes internacionais quanto brasileiros em estados
 * com fuso distinto (AM, MT, MS, RO, RR, AC, Fernando de Noronha).
 *
 * Resolução de fuso (em ordem de prioridade):
 *   1. Override manual do cliente (timezone salvo no cadastro)
 *   2. DDD brasileiro (telefone +55) — diferencia AM, MT, AC etc.
 *   3. UF cadastrada (fallback BR)
 *   4. País detectado pelo DDI (fallback internacional)
 */
export const ZappTimezoneBanner = memo(function ZappTimezoneBanner({
  phone,
  clientTimezone,
  clientState,
}: ZappTimezoneBannerProps) {
  const country = getCountryFromPhone(phone);
  const resolved = resolveClientTimezone({
    manualTimezone: clientTimezone,
    phone,
    state: clientState,
    countryCode: country?.code,
  });

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!resolved) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [resolved?.timezone]);

  if (!resolved) return null;

  const tz = resolved.timezone;
  const source = resolved.source;
  const offset = getTimezoneOffsetHours(tz, now);

  // Mostra banner se: (a) override manual OU (b) cliente fora de UTC−3
  // (internacional ou brasileiro em fuso diferente).
  const sameAsBrasilia = offset === -3;
  if (source !== "manual" && sameAsBrasilia) return null;

  const localTime = getLocalTime(tz, now);
  const offsetLabel = formatTimezoneOffset(offset);
  const offHours = isOutsideBusinessHours(tz, now);

  const colors = country
    ? getFlagColors(country.code)
    : { background: "hsl(var(--muted))", text: "hsl(var(--foreground))", stripes: ["hsl(var(--primary))"] };

  const stripeGradient =
    colors.stripes.length === 1
      ? colors.stripes[0]
      : `linear-gradient(to bottom, ${colors.stripes
          .map((c, i) => `${c} ${(i / colors.stripes.length) * 100}%, ${c} ${((i + 1) / colors.stripes.length) * 100}%`)
          .join(", ")})`;

  const isInternational = country && country.code !== "BR";
  const headline =
    isInternational
      ? `Cliente internacional · ${country.name}`
      : source === "manual"
        ? "Fuso ajustado manualmente"
        : source === "ddd"
          ? "Fuso detectado pelo DDD"
          : source === "state"
            ? "Fuso detectado pela UF"
            : "Fuso diferente de Brasília";

  const sourceLabel: Record<NonNullable<TimezoneSource>, string> = {
    manual: "manual",
    ddd: "DDD",
    state: "UF",
    ddi: "DDI",
  };

  return (
    <div
      className="flex items-stretch border-b border-white/10 overflow-hidden"
      style={{ backgroundColor: colors.background }}
      role="status"
      aria-live="polite"
    >
      <div
        className="w-2 sm:w-2.5 shrink-0"
        style={{ background: stripeGradient }}
        aria-hidden
      />

      <div
        className="flex-1 px-3 sm:px-4 py-2.5 flex items-center gap-2.5 sm:gap-3 text-sm min-w-0"
        style={{ color: colors.text }}
      >
        {country && (
          <span className="text-lg sm:text-xl leading-none" aria-hidden>
            {country.flag}
          </span>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 flex-1">
          <span className="font-semibold truncate text-sm flex items-center gap-1.5">
            {headline}
            {source === "manual" ? (
              <Pin className="h-3 w-3 opacity-70" aria-label="Fuso definido manualmente" />
            ) : (
              <Wand2 className="h-3 w-3 opacity-60" aria-label={`Detectado via ${source && sourceLabel[source]}`} />
            )}
          </span>
          <span className="flex items-center gap-1 text-xs">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span className="font-medium">
              {localTime} ({offsetLabel})
            </span>
            <Globe2 className="h-3.5 w-3.5 ml-1" aria-hidden />
            <span className="hidden sm:inline">
              {tz}
              {source && source !== "manual" && (
                <span className="opacity-70"> · via {sourceLabel[source]}</span>
              )}
            </span>
          </span>
        </div>

        {offHours && (
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400 text-amber-950 font-bold text-xs whitespace-nowrap shadow-sm border border-amber-600/40"
            title={`Volta ao expediente em ${formatDurationShort(msUntilNextBusinessHour(tz, now))}`}
            aria-label={`Fora do horário comercial. Volta em ${formatDurationShort(msUntilNextBusinessHour(tz, now))}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Fora do horário ·</span>
            <span className="sm:hidden">Off ·</span>
            volta em {formatDurationShort(msUntilNextBusinessHour(tz, now))}
          </span>
        )}
      </div>
    </div>
  );
});
