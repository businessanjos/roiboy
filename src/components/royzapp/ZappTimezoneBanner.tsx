import { memo, useEffect, useState } from "react";
import { Clock, Globe2, AlertTriangle } from "lucide-react";
import { getCountryFromPhone } from "@/lib/phoneCountry";
import { getFlagColors } from "@/lib/countryFlagColors";
import {
  formatDurationShort,
  formatTimezoneOffset,
  getLocalTime,
  getTimezoneForCountry,
  getTimezoneOffsetHours,
  isOutsideBusinessHours,
  msUntilNextBusinessHour,
} from "@/lib/countryTimezone";

interface ZappTimezoneBannerProps {
  phone: string | null | undefined;
}

/**
 * Banner exibido em conversas com clientes internacionais (DDI != +55).
 * Usa as cores da bandeira do país como faixa lateral vertical para identificação
 * visual imediata, mantendo fundo escuro de alto contraste para legibilidade.
 * Quando fora do horário comercial, exibe um badge âmbar destacado inline.
 */
export const ZappTimezoneBanner = memo(function ZappTimezoneBanner({
  phone,
}: ZappTimezoneBannerProps) {
  const country = getCountryFromPhone(phone);
  const tz = country ? getTimezoneForCountry(country.code) : null;

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!tz) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [tz]);

  if (!country || country.code === "BR" || !tz) return null;

  const localTime = getLocalTime(tz, now);
  const offset = getTimezoneOffsetHours(tz, now);
  const offsetLabel = formatTimezoneOffset(offset);
  const offHours = isOutsideBusinessHours(tz, now);
  const colors = getFlagColors(country.code);

  // Faixa lateral: gradiente vertical com as cores da bandeira
  const stripeGradient =
    colors.stripes.length === 1
      ? colors.stripes[0]
      : `linear-gradient(to bottom, ${colors.stripes
          .map((c, i) => `${c} ${(i / colors.stripes.length) * 100}%, ${c} ${((i + 1) / colors.stripes.length) * 100}%`)
          .join(", ")})`;

  return (
    <div
      className="flex items-stretch border-b border-white/10 overflow-hidden"
      style={{ backgroundColor: colors.background }}
      role="status"
      aria-live="polite"
    >
      {/* Faixa lateral colorida com cores da bandeira */}
      <div
        className="w-1.5 sm:w-2 shrink-0"
        style={{ background: stripeGradient }}
        aria-hidden
      />

      <div
        className="flex-1 px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm min-w-0"
        style={{ color: colors.text }}
      >
        <span className="text-base sm:text-lg leading-none" aria-hidden>
          {country.flag}
        </span>

        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 flex-1">
          <span className="font-medium truncate">
            Cliente internacional · {country.name}
          </span>
          <span className="flex items-center gap-1 text-[11px] sm:text-xs opacity-90">
            <Clock className="h-3 w-3" />
            {localTime} ({offsetLabel})
            <Globe2 className="h-3 w-3 ml-1 opacity-70" />
            <span className="hidden sm:inline opacity-80">{tz}</span>
          </span>
        </div>

        {offHours && (
          <span
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500 text-amber-950 font-semibold text-[11px] sm:text-xs whitespace-nowrap shadow-sm"
            title={`Volta ao expediente em ${formatDurationShort(msUntilNextBusinessHour(tz, now))}`}
          >
            <AlertTriangle className="h-3 w-3" />
            <span className="hidden sm:inline">Fora do horário ·</span>
            <span className="sm:hidden">Off ·</span>
            volta em {formatDurationShort(msUntilNextBusinessHour(tz, now))}
          </span>
        )}
      </div>
    </div>
  );
});
