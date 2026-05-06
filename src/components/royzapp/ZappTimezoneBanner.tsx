import { memo, useEffect, useState } from "react";
import { Clock, Globe2 } from "lucide-react";
import { getCountryFromPhone } from "@/lib/phoneCountry";
import {
  formatTimezoneOffset,
  getLocalTime,
  getTimezoneForCountry,
  getTimezoneOffsetHours,
  isOutsideBusinessHours,
} from "@/lib/countryTimezone";
import { cn } from "@/lib/utils";

interface ZappTimezoneBannerProps {
  phone: string | null | undefined;
}

/**
 * Banner exibido em conversas com clientes internacionais (DDI != +55).
 * Mostra a bandeira do país, hora local atual e fuso horário, com aviso
 * destacado quando o horário local está fora da janela comercial (8h–21h).
 */
export const ZappTimezoneBanner = memo(function ZappTimezoneBanner({
  phone,
}: ZappTimezoneBannerProps) {
  const country = getCountryFromPhone(phone);
  const tz = country ? getTimezoneForCountry(country.code) : null;

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!tz) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [tz]);

  if (!country || country.code === "BR" || !tz) return null;

  const localTime = getLocalTime(tz, now);
  const offset = getTimezoneOffsetHours(tz, now);
  const offsetLabel = formatTimezoneOffset(offset);
  const offHours = isOutsideBusinessHours(tz, now);

  return (
    <div
      className={cn(
        "px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 text-xs sm:text-sm border-b",
        offHours
          ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
          : "bg-sky-500/10 border-sky-500/30 text-sky-200",
      )}
      role="status"
      aria-live="polite"
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
      {offHours ? (
        <span className="font-semibold text-amber-100 text-[11px] sm:text-xs whitespace-nowrap">
          Fora do horário comercial — evite mensagens agora
        </span>
      ) : (
        <span className="opacity-80 text-[11px] sm:text-xs whitespace-nowrap hidden md:inline">
          Atenção ao fuso antes de enviar
        </span>
      )}
    </div>
  );
});
