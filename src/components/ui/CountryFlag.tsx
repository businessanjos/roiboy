import { getCountryFromPhone } from "@/lib/phoneCountry";

interface CountryFlagProps {
  phone: string | null | undefined;
  /** Esconde a bandeira do Brasil (padrão: true). */
  hideBR?: boolean;
  className?: string;
}

/**
 * Mostra o emoji da bandeira do país inferido pelo DDI do telefone E.164.
 * Por padrão, não exibe nada para números brasileiros (+55) — o CRM é BR-first.
 */
export function CountryFlag({ phone, hideBR = true, className }: CountryFlagProps) {
  const country = getCountryFromPhone(phone);
  if (!country) return null;
  if (hideBR && country.code === "BR") return null;
  return (
    <span
      className={className}
      title={country.name}
      aria-label={country.name}
      role="img"
    >
      {country.flag}
    </span>
  );
}
