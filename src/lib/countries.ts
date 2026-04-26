// Lista de países (ISO 3166-1 alpha-2) com moeda padrão (ISO 4217).
// Usada no briefing operacional para localização e valores monetários internacionais.

export interface CountryInfo {
  code: string; // ISO alpha-2
  name: string; // pt-BR
  currency: string; // ISO 4217
  currencySymbol: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "BR", name: "Brasil", currency: "BRL", currencySymbol: "R$" },
  { code: "US", name: "Estados Unidos", currency: "USD", currencySymbol: "$" },
  { code: "PT", name: "Portugal", currency: "EUR", currencySymbol: "€" },
  { code: "ES", name: "Espanha", currency: "EUR", currencySymbol: "€" },
  { code: "FR", name: "França", currency: "EUR", currencySymbol: "€" },
  { code: "IT", name: "Itália", currency: "EUR", currencySymbol: "€" },
  { code: "DE", name: "Alemanha", currency: "EUR", currencySymbol: "€" },
  { code: "GB", name: "Reino Unido", currency: "GBP", currencySymbol: "£" },
  { code: "IE", name: "Irlanda", currency: "EUR", currencySymbol: "€" },
  { code: "NL", name: "Países Baixos", currency: "EUR", currencySymbol: "€" },
  { code: "BE", name: "Bélgica", currency: "EUR", currencySymbol: "€" },
  { code: "CH", name: "Suíça", currency: "CHF", currencySymbol: "CHF" },
  { code: "AT", name: "Áustria", currency: "EUR", currencySymbol: "€" },
  { code: "SE", name: "Suécia", currency: "SEK", currencySymbol: "kr" },
  { code: "NO", name: "Noruega", currency: "NOK", currencySymbol: "kr" },
  { code: "DK", name: "Dinamarca", currency: "DKK", currencySymbol: "kr" },
  { code: "FI", name: "Finlândia", currency: "EUR", currencySymbol: "€" },
  { code: "PL", name: "Polônia", currency: "PLN", currencySymbol: "zł" },
  { code: "CZ", name: "Tchéquia", currency: "CZK", currencySymbol: "Kč" },
  { code: "AR", name: "Argentina", currency: "ARS", currencySymbol: "$" },
  { code: "CL", name: "Chile", currency: "CLP", currencySymbol: "$" },
  { code: "UY", name: "Uruguai", currency: "UYU", currencySymbol: "$U" },
  { code: "PY", name: "Paraguai", currency: "PYG", currencySymbol: "₲" },
  { code: "BO", name: "Bolívia", currency: "BOB", currencySymbol: "Bs" },
  { code: "PE", name: "Peru", currency: "PEN", currencySymbol: "S/" },
  { code: "CO", name: "Colômbia", currency: "COP", currencySymbol: "$" },
  { code: "VE", name: "Venezuela", currency: "VES", currencySymbol: "Bs" },
  { code: "EC", name: "Equador", currency: "USD", currencySymbol: "$" },
  { code: "MX", name: "México", currency: "MXN", currencySymbol: "$" },
  { code: "CA", name: "Canadá", currency: "CAD", currencySymbol: "C$" },
  { code: "JP", name: "Japão", currency: "JPY", currencySymbol: "¥" },
  { code: "CN", name: "China", currency: "CNY", currencySymbol: "¥" },
  { code: "KR", name: "Coreia do Sul", currency: "KRW", currencySymbol: "₩" },
  { code: "IN", name: "Índia", currency: "INR", currencySymbol: "₹" },
  { code: "AU", name: "Austrália", currency: "AUD", currencySymbol: "A$" },
  { code: "NZ", name: "Nova Zelândia", currency: "NZD", currencySymbol: "NZ$" },
  { code: "ZA", name: "África do Sul", currency: "ZAR", currencySymbol: "R" },
  { code: "AE", name: "Emirados Árabes Unidos", currency: "AED", currencySymbol: "د.إ" },
  { code: "IL", name: "Israel", currency: "ILS", currencySymbol: "₪" },
  { code: "TR", name: "Turquia", currency: "TRY", currencySymbol: "₺" },
  { code: "RU", name: "Rússia", currency: "RUB", currencySymbol: "₽" },
  { code: "AO", name: "Angola", currency: "AOA", currencySymbol: "Kz" },
  { code: "MZ", name: "Moçambique", currency: "MZN", currencySymbol: "MT" },
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
