// Lista de países (ISO 3166-1 alpha-2) com moeda padrão (ISO 4217).
// Usada no briefing operacional para localização e valores monetários internacionais.

export interface CountryInfo {
  code: string; // ISO alpha-2
  name: string; // pt-BR
  currency: string; // ISO 4217
  currencySymbol: string;
  flag: string; // emoji da bandeira
}

// Converte código ISO alpha-2 em emoji de bandeira (Regional Indicator Symbols)
export const codeToFlag = (code: string): string => {
  if (!code || code.length !== 2) return "";
  const base = 127397; // 0x1F1E6 - 'A'.charCodeAt(0)
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => c.charCodeAt(0) + base));
};

export const COUNTRIES: CountryInfo[] = [
  { code: "BR", name: "Brasil", currency: "BRL", currencySymbol: "R$", flag: "🇧🇷" },
  { code: "US", name: "Estados Unidos", currency: "USD", currencySymbol: "$", flag: "🇺🇸" },
  { code: "PT", name: "Portugal", currency: "EUR", currencySymbol: "€", flag: "🇵🇹" },
  { code: "ES", name: "Espanha", currency: "EUR", currencySymbol: "€", flag: "🇪🇸" },
  { code: "FR", name: "França", currency: "EUR", currencySymbol: "€", flag: "🇫🇷" },
  { code: "IT", name: "Itália", currency: "EUR", currencySymbol: "€", flag: "🇮🇹" },
  { code: "DE", name: "Alemanha", currency: "EUR", currencySymbol: "€", flag: "🇩🇪" },
  { code: "GB", name: "Reino Unido", currency: "GBP", currencySymbol: "£", flag: "🇬🇧" },
  { code: "IE", name: "Irlanda", currency: "EUR", currencySymbol: "€", flag: "🇮🇪" },
  { code: "NL", name: "Países Baixos", currency: "EUR", currencySymbol: "€", flag: "🇳🇱" },
  { code: "BE", name: "Bélgica", currency: "EUR", currencySymbol: "€", flag: "🇧🇪" },
  { code: "CH", name: "Suíça", currency: "CHF", currencySymbol: "CHF", flag: "🇨🇭" },
  { code: "AT", name: "Áustria", currency: "EUR", currencySymbol: "€", flag: "🇦🇹" },
  { code: "SE", name: "Suécia", currency: "SEK", currencySymbol: "kr", flag: "🇸🇪" },
  { code: "NO", name: "Noruega", currency: "NOK", currencySymbol: "kr", flag: "🇳🇴" },
  { code: "DK", name: "Dinamarca", currency: "DKK", currencySymbol: "kr", flag: "🇩🇰" },
  { code: "FI", name: "Finlândia", currency: "EUR", currencySymbol: "€", flag: "🇫🇮" },
  { code: "PL", name: "Polônia", currency: "PLN", currencySymbol: "zł", flag: "🇵🇱" },
  { code: "CZ", name: "Tchéquia", currency: "CZK", currencySymbol: "Kč", flag: "🇨🇿" },
  { code: "AR", name: "Argentina", currency: "ARS", currencySymbol: "$", flag: "🇦🇷" },
  { code: "CL", name: "Chile", currency: "CLP", currencySymbol: "$", flag: "🇨🇱" },
  { code: "UY", name: "Uruguai", currency: "UYU", currencySymbol: "$U", flag: "🇺🇾" },
  { code: "PY", name: "Paraguai", currency: "PYG", currencySymbol: "₲", flag: "🇵🇾" },
  { code: "BO", name: "Bolívia", currency: "BOB", currencySymbol: "Bs", flag: "🇧🇴" },
  { code: "PE", name: "Peru", currency: "PEN", currencySymbol: "S/", flag: "🇵🇪" },
  { code: "CO", name: "Colômbia", currency: "COP", currencySymbol: "$", flag: "🇨🇴" },
  { code: "VE", name: "Venezuela", currency: "VES", currencySymbol: "Bs", flag: "🇻🇪" },
  { code: "EC", name: "Equador", currency: "USD", currencySymbol: "$", flag: "🇪🇨" },
  { code: "MX", name: "México", currency: "MXN", currencySymbol: "$", flag: "🇲🇽" },
  { code: "CA", name: "Canadá", currency: "CAD", currencySymbol: "C$", flag: "🇨🇦" },
  { code: "JP", name: "Japão", currency: "JPY", currencySymbol: "¥", flag: "🇯🇵" },
  { code: "CN", name: "China", currency: "CNY", currencySymbol: "¥", flag: "🇨🇳" },
  { code: "KR", name: "Coreia do Sul", currency: "KRW", currencySymbol: "₩", flag: "🇰🇷" },
  { code: "IN", name: "Índia", currency: "INR", currencySymbol: "₹", flag: "🇮🇳" },
  { code: "AU", name: "Austrália", currency: "AUD", currencySymbol: "A$", flag: "🇦🇺" },
  { code: "NZ", name: "Nova Zelândia", currency: "NZD", currencySymbol: "NZ$", flag: "🇳🇿" },
  { code: "ZA", name: "África do Sul", currency: "ZAR", currencySymbol: "R", flag: "🇿🇦" },
  { code: "AE", name: "Emirados Árabes Unidos", currency: "AED", currencySymbol: "د.إ", flag: "🇦🇪" },
  { code: "IL", name: "Israel", currency: "ILS", currencySymbol: "₪", flag: "🇮🇱" },
  { code: "TR", name: "Turquia", currency: "TRY", currencySymbol: "₺", flag: "🇹🇷" },
  { code: "RU", name: "Rússia", currency: "RUB", currencySymbol: "₽", flag: "🇷🇺" },
  { code: "AO", name: "Angola", currency: "AOA", currencySymbol: "Kz", flag: "🇦🇴" },
  { code: "MZ", name: "Moçambique", currency: "MZN", currencySymbol: "MT", flag: "🇲🇿" },
];

export const getCountry = (code?: string | null): CountryInfo | undefined =>
  code ? COUNTRIES.find((c) => c.code === code.toUpperCase()) : undefined;

// 27 UFs do Brasil
export const BRAZIL_STATES: { uf: string; name: string }[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];
