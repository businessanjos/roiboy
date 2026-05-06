/**
 * Mapeia código ISO alpha-2 de país para suas cores principais de bandeira.
 * Usado no ZappTimezoneBanner para criar uma faixa lateral temática.
 *
 * As cores são em HEX e ordenadas conforme aparecem na bandeira (top→bottom
 * ou left→right), formando um gradiente vertical de listras.
 */

export interface FlagColors {
  /** 2-4 cores principais da bandeira em HEX */
  stripes: string[];
  /** Cor recomendada para o fundo do banner (escura, complementar) */
  background: string;
  /** Cor de texto sobre o fundo (alto contraste) */
  text: string;
}

const DEFAULT_COLORS: FlagColors = {
  stripes: ["hsl(var(--primary))"],
  background: "hsl(var(--muted))",
  text: "hsl(var(--foreground))",
};

const COLORS: Record<string, FlagColors> = {
  // Europa
  PT: { stripes: ["#006600", "#FF0000"], background: "#0a1f0a", text: "#ffffff" },
  ES: { stripes: ["#AA151B", "#F1BF00", "#AA151B"], background: "#2a0a0a", text: "#ffffff" },
  FR: { stripes: ["#0055A4", "#FFFFFF", "#EF4135"], background: "#0a1530", text: "#ffffff" },
  IT: { stripes: ["#009246", "#FFFFFF", "#CE2B37"], background: "#0a1f0a", text: "#ffffff" },
  DE: { stripes: ["#000000", "#DD0000", "#FFCE00"], background: "#1a0a0a", text: "#ffffff" },
  GB: { stripes: ["#012169", "#FFFFFF", "#C8102E"], background: "#0a1530", text: "#ffffff" },
  IE: { stripes: ["#169B62", "#FFFFFF", "#FF883E"], background: "#0a1f0a", text: "#ffffff" },
  NL: { stripes: ["#AE1C28", "#FFFFFF", "#21468B"], background: "#0a1530", text: "#ffffff" },
  BE: { stripes: ["#000000", "#FAE042", "#ED2939"], background: "#1a0a0a", text: "#ffffff" },
  CH: { stripes: ["#FF0000", "#FFFFFF"], background: "#2a0a0a", text: "#ffffff" },
  AT: { stripes: ["#ED2939", "#FFFFFF", "#ED2939"], background: "#2a0a0a", text: "#ffffff" },
  SE: { stripes: ["#006AA7", "#FECC00"], background: "#0a1530", text: "#ffffff" },
  NO: { stripes: ["#EF2B2D", "#FFFFFF", "#002868"], background: "#0a1530", text: "#ffffff" },
  DK: { stripes: ["#C8102E", "#FFFFFF"], background: "#2a0a0a", text: "#ffffff" },
  FI: { stripes: ["#FFFFFF", "#003580"], background: "#0a1530", text: "#ffffff" },
  PL: { stripes: ["#FFFFFF", "#DC143C"], background: "#2a0a0a", text: "#ffffff" },
  CZ: { stripes: ["#FFFFFF", "#D7141A", "#11457E"], background: "#0a1530", text: "#ffffff" },
  GR: { stripes: ["#0D5EAF", "#FFFFFF"], background: "#0a1530", text: "#ffffff" },
  HU: { stripes: ["#CE2939", "#FFFFFF", "#477050"], background: "#1a0a0a", text: "#ffffff" },
  LU: { stripes: ["#ED2939", "#FFFFFF", "#00A1DE"], background: "#0a1530", text: "#ffffff" },
  // Américas
  US: { stripes: ["#B22234", "#FFFFFF", "#3C3B6E"], background: "#0a1530", text: "#ffffff" },
  CA: { stripes: ["#FF0000", "#FFFFFF", "#FF0000"], background: "#2a0a0a", text: "#ffffff" },
  MX: { stripes: ["#006847", "#FFFFFF", "#CE1126"], background: "#0a1f0a", text: "#ffffff" },
  AR: { stripes: ["#74ACDF", "#FFFFFF", "#74ACDF"], background: "#0a1530", text: "#ffffff" },
  CL: { stripes: ["#0039A6", "#FFFFFF", "#D52B1E"], background: "#0a1530", text: "#ffffff" },
  UY: { stripes: ["#0038A8", "#FFFFFF"], background: "#0a1530", text: "#ffffff" },
  PY: { stripes: ["#D52B1E", "#FFFFFF", "#0038A8"], background: "#1a0a0a", text: "#ffffff" },
  BO: { stripes: ["#D52B1E", "#F9E300", "#007934"], background: "#1a0a0a", text: "#ffffff" },
  PE: { stripes: ["#D91023", "#FFFFFF", "#D91023"], background: "#2a0a0a", text: "#ffffff" },
  CO: { stripes: ["#FCD116", "#003893", "#CE1126"], background: "#1a1500", text: "#ffffff" },
  VE: { stripes: ["#FCD116", "#00247D", "#CF142B"], background: "#0a1530", text: "#ffffff" },
  EC: { stripes: ["#FFD100", "#0072CE", "#EF3340"], background: "#1a1500", text: "#ffffff" },
  BR: { stripes: ["#009C3B", "#FFDF00", "#002776"], background: "#0a1530", text: "#ffffff" },
  // Ásia / Oceania
  JP: { stripes: ["#FFFFFF", "#BC002D"], background: "#1a0a0a", text: "#ffffff" },
  CN: { stripes: ["#DE2910", "#FFDE00"], background: "#1a0a0a", text: "#ffffff" },
  KR: { stripes: ["#FFFFFF", "#CD2E3A", "#0047A0"], background: "#0a1530", text: "#ffffff" },
  IN: { stripes: ["#FF9933", "#FFFFFF", "#138808"], background: "#0a1f0a", text: "#ffffff" },
  AU: { stripes: ["#012169", "#FFFFFF", "#E4002B"], background: "#0a1530", text: "#ffffff" },
  NZ: { stripes: ["#012169", "#FFFFFF", "#C8102E"], background: "#0a1530", text: "#ffffff" },
  SG: { stripes: ["#ED2939", "#FFFFFF"], background: "#2a0a0a", text: "#ffffff" },
  TH: { stripes: ["#ED1C24", "#FFFFFF", "#241D4F"], background: "#0a1530", text: "#ffffff" },
  // Oriente Médio / África
  AE: { stripes: ["#00732F", "#FFFFFF", "#000000", "#FF0000"], background: "#0a1f0a", text: "#ffffff" },
  SA: { stripes: ["#006C35", "#FFFFFF"], background: "#0a1f0a", text: "#ffffff" },
  IL: { stripes: ["#FFFFFF", "#0038B8"], background: "#0a1530", text: "#ffffff" },
  EG: { stripes: ["#CE1126", "#FFFFFF", "#000000"], background: "#1a0a0a", text: "#ffffff" },
  ZA: { stripes: ["#007749", "#FFB81C", "#001489", "#E03C31"], background: "#0a1f0a", text: "#ffffff" },
  TR: { stripes: ["#E30A17", "#FFFFFF"], background: "#2a0a0a", text: "#ffffff" },
};

export function getFlagColors(countryCode: string | null | undefined): FlagColors {
  if (!countryCode) return DEFAULT_COLORS;
  return COLORS[countryCode.toUpperCase()] ?? DEFAULT_COLORS;
}
