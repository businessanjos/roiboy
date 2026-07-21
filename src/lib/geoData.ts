// Dados geográficos estáticos para o mapa do Dashboard.

export type BRRegion = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";
export type Continent = "América do Sul" | "América do Norte" | "América Central" | "Europa" | "Ásia" | "Oceania" | "África";

export interface UFInfo {
  uf: string;
  name: string;
  region: BRRegion;
  lat: number;
  lng: number;
}

export const BR_UFS: UFInfo[] = [
  { uf: "AC", name: "Acre", region: "Norte", lat: -8.77, lng: -70.55 },
  { uf: "AL", name: "Alagoas", region: "Nordeste", lat: -9.62, lng: -36.82 },
  { uf: "AP", name: "Amapá", region: "Norte", lat: 1.41, lng: -51.77 },
  { uf: "AM", name: "Amazonas", region: "Norte", lat: -3.47, lng: -65.10 },
  { uf: "BA", name: "Bahia", region: "Nordeste", lat: -12.97, lng: -41.72 },
  { uf: "CE", name: "Ceará", region: "Nordeste", lat: -5.20, lng: -39.53 },
  { uf: "DF", name: "Distrito Federal", region: "Centro-Oeste", lat: -15.83, lng: -47.86 },
  { uf: "ES", name: "Espírito Santo", region: "Sudeste", lat: -19.19, lng: -40.34 },
  { uf: "GO", name: "Goiás", region: "Centro-Oeste", lat: -15.98, lng: -49.86 },
  { uf: "MA", name: "Maranhão", region: "Nordeste", lat: -5.42, lng: -45.44 },
  { uf: "MT", name: "Mato Grosso", region: "Centro-Oeste", lat: -12.64, lng: -55.42 },
  { uf: "MS", name: "Mato Grosso do Sul", region: "Centro-Oeste", lat: -20.51, lng: -54.54 },
  { uf: "MG", name: "Minas Gerais", region: "Sudeste", lat: -18.10, lng: -44.38 },
  { uf: "PA", name: "Pará", region: "Norte", lat: -3.79, lng: -52.48 },
  { uf: "PB", name: "Paraíba", region: "Nordeste", lat: -7.28, lng: -36.72 },
  { uf: "PR", name: "Paraná", region: "Sul", lat: -24.89, lng: -51.55 },
  { uf: "PE", name: "Pernambuco", region: "Nordeste", lat: -8.38, lng: -37.86 },
  { uf: "PI", name: "Piauí", region: "Nordeste", lat: -7.72, lng: -42.72 },
  { uf: "RJ", name: "Rio de Janeiro", region: "Sudeste", lat: -22.25, lng: -42.66 },
  { uf: "RN", name: "Rio Grande do Norte", region: "Nordeste", lat: -5.81, lng: -36.59 },
  { uf: "RS", name: "Rio Grande do Sul", region: "Sul", lat: -30.17, lng: -53.50 },
  { uf: "RO", name: "Rondônia", region: "Norte", lat: -10.83, lng: -63.34 },
  { uf: "RR", name: "Roraima", region: "Norte", lat: 1.99, lng: -61.33 },
  { uf: "SC", name: "Santa Catarina", region: "Sul", lat: -27.24, lng: -50.22 },
  { uf: "SP", name: "São Paulo", region: "Sudeste", lat: -22.19, lng: -48.79 },
  { uf: "SE", name: "Sergipe", region: "Nordeste", lat: -10.57, lng: -37.45 },
  { uf: "TO", name: "Tocantins", region: "Norte", lat: -9.46, lng: -48.26 },
];

export const BR_REGIONS: BRRegion[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export const UF_BY_CODE: Record<string, UFInfo> = Object.fromEntries(BR_UFS.map(u => [u.uf, u]));

export interface CountryGeo {
  name: string;   // pt-BR (matches clients.country storage)
  code: string;   // ISO2
  continent: Continent;
  lat: number;
  lng: number;
}

// Centróides aproximados (subset comum). Nomes em pt-BR alinhados a src/lib/countries.ts.
export const COUNTRY_GEO: CountryGeo[] = [
  { name: "Brasil", code: "BR", continent: "América do Sul", lat: -14.2, lng: -51.9 },
  { name: "Argentina", code: "AR", continent: "América do Sul", lat: -38.4, lng: -63.6 },
  { name: "Chile", code: "CL", continent: "América do Sul", lat: -35.7, lng: -71.5 },
  { name: "Uruguai", code: "UY", continent: "América do Sul", lat: -32.5, lng: -55.8 },
  { name: "Paraguai", code: "PY", continent: "América do Sul", lat: -23.4, lng: -58.4 },
  { name: "Colômbia", code: "CO", continent: "América do Sul", lat: 4.6, lng: -74.1 },
  { name: "Peru", code: "PE", continent: "América do Sul", lat: -9.2, lng: -75.0 },
  { name: "Venezuela", code: "VE", continent: "América do Sul", lat: 6.4, lng: -66.6 },
  { name: "Equador", code: "EC", continent: "América do Sul", lat: -1.8, lng: -78.2 },
  { name: "Bolívia", code: "BO", continent: "América do Sul", lat: -16.3, lng: -63.6 },
  { name: "Estados Unidos", code: "US", continent: "América do Norte", lat: 39.8, lng: -98.6 },
  { name: "Canadá", code: "CA", continent: "América do Norte", lat: 56.1, lng: -106.3 },
  { name: "México", code: "MX", continent: "América do Norte", lat: 23.6, lng: -102.5 },
  { name: "Portugal", code: "PT", continent: "Europa", lat: 39.4, lng: -8.2 },
  { name: "Espanha", code: "ES", continent: "Europa", lat: 40.5, lng: -3.7 },
  { name: "França", code: "FR", continent: "Europa", lat: 46.2, lng: 2.2 },
  { name: "Itália", code: "IT", continent: "Europa", lat: 41.9, lng: 12.6 },
  { name: "Alemanha", code: "DE", continent: "Europa", lat: 51.2, lng: 10.5 },
  { name: "Reino Unido", code: "GB", continent: "Europa", lat: 55.4, lng: -3.4 },
  { name: "Irlanda", code: "IE", continent: "Europa", lat: 53.4, lng: -8.2 },
  { name: "Países Baixos", code: "NL", continent: "Europa", lat: 52.1, lng: 5.3 },
  { name: "Bélgica", code: "BE", continent: "Europa", lat: 50.5, lng: 4.5 },
  { name: "Suíça", code: "CH", continent: "Europa", lat: 46.8, lng: 8.2 },
  { name: "Áustria", code: "AT", continent: "Europa", lat: 47.5, lng: 14.6 },
  { name: "Suécia", code: "SE", continent: "Europa", lat: 60.1, lng: 18.6 },
  { name: "Noruega", code: "NO", continent: "Europa", lat: 60.5, lng: 8.5 },
  { name: "Dinamarca", code: "DK", continent: "Europa", lat: 56.3, lng: 9.5 },
  { name: "Polônia", code: "PL", continent: "Europa", lat: 51.9, lng: 19.1 },
  { name: "Japão", code: "JP", continent: "Ásia", lat: 36.2, lng: 138.3 },
  { name: "China", code: "CN", continent: "Ásia", lat: 35.9, lng: 104.2 },
  { name: "Coreia do Sul", code: "KR", continent: "Ásia", lat: 35.9, lng: 127.8 },
  { name: "Índia", code: "IN", continent: "Ásia", lat: 20.6, lng: 78.9 },
  { name: "Emirados Árabes Unidos", code: "AE", continent: "Ásia", lat: 23.4, lng: 53.8 },
  { name: "Austrália", code: "AU", continent: "Oceania", lat: -25.3, lng: 133.8 },
  { name: "Nova Zelândia", code: "NZ", continent: "Oceania", lat: -40.9, lng: 174.9 },
  { name: "África do Sul", code: "ZA", continent: "África", lat: -30.6, lng: 22.9 },
];

export const CONTINENTS: Continent[] = [
  "América do Sul", "América do Norte", "Europa", "Ásia", "Oceania", "África", "América Central",
];

export const COUNTRY_BY_NAME: Record<string, CountryGeo> = Object.fromEntries(
  COUNTRY_GEO.map(c => [c.name.toLowerCase(), c])
);

export function normalizeCountry(raw?: string | null): CountryGeo | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return COUNTRY_BY_NAME[key] ?? null;
}
