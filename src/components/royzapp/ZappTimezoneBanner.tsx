import { memo, useEffect, useState } from "react";
import { Clock, Globe2, AlertTriangle, Pin } from "lucide-react";
import { getCountryFromPhone } from "@/lib/phoneCountry";
import { getFlagColors } from "@/lib/countryFlagColors";
import {
  formatDurationShort,
  formatTimezoneOffset,
  getLocalTime,
  getTimezoneForCountry,
  getTimezoneOffsetHours,
  isOutsideBusinessHours,
  isValidTimezone,
  msUntilNextBusinessHour,
} from "@/lib/countryTimezone";

interface ZappTimezoneBannerProps {
  phone: string | null | undefined;
  /**
   * Override manual de fuso horário (IANA) vindo do cadastro do cliente.
   * Quando presente, sempre tem prioridade sobre a detecção automática
   * pelo DDI/telefone — corrige casos como Manaus, Acre, expatriados ou
   * números virtuais com DDI estrangeiro.
   */
  clientTimezone?: string | null;
}

/**
 * Banner exibido quando o cliente está em fuso diferente do horário de Brasília
 * (UTC−3). Cobre tanto clientes internacionais quanto brasileiros em estados
 * com fuso distinto (AM, MT, MS, RO, RR, AC, Fernando de Noronha).
 *
 * Prioridade: override manual do cliente > detecção pelo DDI > nada.
 */
export const ZappTimezoneBanner = memo(function ZappTimezoneBanner({
  phone,
  clientTimezone,
}: ZappTimezoneBannerProps) {
  const country = getCountryFromPhone(phone);
  const autoTz = country ? getTimezoneForCountry(country.code) : null;
  const manualTz = isValidTimezone(clientTimezone) ? clientTimezone! : null;
  const tz = manualTz || autoTz;

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!tz) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [tz]);

  if (!tz) return null;

  const offset = getTimezoneOffsetHours(tz, now);

  // Mostrar banner se: cliente internacional OU brasileiro fora de Brasília
  // (offset != -3) OU override manual ativo. Caso contrário, fica oculto.
  const isBrazilDefault = country?.code === "BR" && !manualTz;
  const sameAsBrasilia = offset === -3;
  if (isBrazilDefault && sameAsBrasilia) return null;

  const localTime = getLocalTime(tz, now);
  const offsetLabel = formatTimezoneOffset(offset);
  const offHours = isOutsideBusinessHours(tz, now);

  // Visual: usar bandeira do país detectado se houver; senão, neutro.
  const colors = country
    ? getFlagColors(country.code)
    : { background: "hsl(var(--muted))", text: "hsl(var(--foreground))", stripes: ["hsl(var(--primary))"] };

  const stripeGradient =
    colors.stripes.length === 1
      ? colors.stripes[0]
      : `linear-gradient(to bottom, ${colors.stripes
          .map((c, i) => `${c} ${(i / colors.stripes.length) * 100}%, ${c} ${((i + 1) / colors.stripes.length) * 100}%`)
          .join(", ")})`;

  // Label principal
  const isInternational = country && country.code !== "BR";
  const headline = isInternational
    ? `Cliente internacional · ${country.name}`
    : manualTz
      ? "Fuso ajustado manualmente"
      : "Fuso diferente de Brasília";

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
            {manualTz && (
              <Pin
                className="h-3 w-3 opacity-70"
                aria-label="Fuso horário definido manualmente"
              />
            )}
          </span>
          <span className="flex items-center gap-1 text-xs">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span className="font-medium">
              {localTime} ({offsetLabel})
            </span>
            <Globe2 className="h-3.5 w-3.5 ml-1" aria-hidden />
            <span className="hidden sm:inline">{tz}</span>
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
