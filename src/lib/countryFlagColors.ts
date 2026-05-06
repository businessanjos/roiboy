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

// Backgrounds escuros temáticos reutilizáveis (sempre alto contraste com texto branco)
const BG_NAVY = "#0a1530";
const BG_FOREST = "#0a1f0a";
const BG_WINE = "#2a0a0a";
const BG_PLUM = "#1a0a1f";
const BG_COAL = "#1a0a0a";
const BG_OLIVE = "#1a1500";
const BG_TEAL = "#0a1f1f";

const COLORS: Record<string, FlagColors> = {
  // ========== Europa ==========
  PT: { stripes: ["#006600", "#FF0000"], background: BG_FOREST, text: "#ffffff" },
  ES: { stripes: ["#AA151B", "#F1BF00", "#AA151B"], background: BG_WINE, text: "#ffffff" },
  FR: { stripes: ["#0055A4", "#FFFFFF", "#EF4135"], background: BG_NAVY, text: "#ffffff" },
  IT: { stripes: ["#009246", "#FFFFFF", "#CE2B37"], background: BG_FOREST, text: "#ffffff" },
  DE: { stripes: ["#000000", "#DD0000", "#FFCE00"], background: BG_COAL, text: "#ffffff" },
  GB: { stripes: ["#012169", "#FFFFFF", "#C8102E"], background: BG_NAVY, text: "#ffffff" },
  IE: { stripes: ["#169B62", "#FFFFFF", "#FF883E"], background: BG_FOREST, text: "#ffffff" },
  NL: { stripes: ["#AE1C28", "#FFFFFF", "#21468B"], background: BG_NAVY, text: "#ffffff" },
  BE: { stripes: ["#000000", "#FAE042", "#ED2939"], background: BG_COAL, text: "#ffffff" },
  CH: { stripes: ["#FF0000", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  AT: { stripes: ["#ED2939", "#FFFFFF", "#ED2939"], background: BG_WINE, text: "#ffffff" },
  SE: { stripes: ["#006AA7", "#FECC00"], background: BG_NAVY, text: "#ffffff" },
  NO: { stripes: ["#EF2B2D", "#FFFFFF", "#002868"], background: BG_NAVY, text: "#ffffff" },
  DK: { stripes: ["#C8102E", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  FI: { stripes: ["#FFFFFF", "#003580"], background: BG_NAVY, text: "#ffffff" },
  PL: { stripes: ["#FFFFFF", "#DC143C"], background: BG_WINE, text: "#ffffff" },
  CZ: { stripes: ["#FFFFFF", "#D7141A", "#11457E"], background: BG_NAVY, text: "#ffffff" },
  GR: { stripes: ["#0D5EAF", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  HU: { stripes: ["#CE2939", "#FFFFFF", "#477050"], background: BG_COAL, text: "#ffffff" },
  LU: { stripes: ["#ED2939", "#FFFFFF", "#00A1DE"], background: BG_NAVY, text: "#ffffff" },
  IS: { stripes: ["#02529C", "#FFFFFF", "#DC1E35"], background: BG_NAVY, text: "#ffffff" },
  MT: { stripes: ["#FFFFFF", "#CF142B"], background: BG_WINE, text: "#ffffff" },
  BG: { stripes: ["#FFFFFF", "#00966E", "#D62612"], background: BG_FOREST, text: "#ffffff" },
  RO: { stripes: ["#002B7F", "#FCD116", "#CE1126"], background: BG_NAVY, text: "#ffffff" },
  SK: { stripes: ["#FFFFFF", "#0B4EA2", "#EE1C25"], background: BG_NAVY, text: "#ffffff" },
  SI: { stripes: ["#FFFFFF", "#005DA4", "#ED1C24"], background: BG_NAVY, text: "#ffffff" },
  HR: { stripes: ["#FF0000", "#FFFFFF", "#171796"], background: BG_NAVY, text: "#ffffff" },
  RS: { stripes: ["#C6363C", "#0C4076", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  BA: { stripes: ["#002F6C", "#FECB00"], background: BG_NAVY, text: "#ffffff" },
  MK: { stripes: ["#D20000", "#F8E92E"], background: BG_WINE, text: "#ffffff" },
  AL: { stripes: ["#E41E20", "#000000"], background: BG_WINE, text: "#ffffff" },
  LT: { stripes: ["#FDB913", "#006A44", "#C1272D"], background: BG_FOREST, text: "#ffffff" },
  LV: { stripes: ["#9E1B32", "#FFFFFF", "#9E1B32"], background: BG_WINE, text: "#ffffff" },
  EE: { stripes: ["#0072CE", "#000000", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  MD: { stripes: ["#0046AE", "#FFD200", "#CC092F"], background: BG_NAVY, text: "#ffffff" },
  BY: { stripes: ["#C8313E", "#007C30"], background: BG_WINE, text: "#ffffff" },
  UA: { stripes: ["#005BBB", "#FFD500"], background: BG_NAVY, text: "#ffffff" },
  RU: { stripes: ["#FFFFFF", "#0039A6", "#D52B1E"], background: BG_NAVY, text: "#ffffff" },
  AD: { stripes: ["#10069F", "#FCDD09", "#D50032"], background: BG_NAVY, text: "#ffffff" },
  MC: { stripes: ["#CE1126", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  LI: { stripes: ["#002B7F", "#CE1126"], background: BG_NAVY, text: "#ffffff" },

  // ========== Américas ==========
  US: { stripes: ["#B22234", "#FFFFFF", "#3C3B6E"], background: BG_NAVY, text: "#ffffff" },
  CA: { stripes: ["#FF0000", "#FFFFFF", "#FF0000"], background: BG_WINE, text: "#ffffff" },
  MX: { stripes: ["#006847", "#FFFFFF", "#CE1126"], background: BG_FOREST, text: "#ffffff" },
  AR: { stripes: ["#74ACDF", "#FFFFFF", "#74ACDF"], background: BG_NAVY, text: "#ffffff" },
  CL: { stripes: ["#0039A6", "#FFFFFF", "#D52B1E"], background: BG_NAVY, text: "#ffffff" },
  UY: { stripes: ["#0038A8", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  PY: { stripes: ["#D52B1E", "#FFFFFF", "#0038A8"], background: BG_COAL, text: "#ffffff" },
  BO: { stripes: ["#D52B1E", "#F9E300", "#007934"], background: BG_COAL, text: "#ffffff" },
  PE: { stripes: ["#D91023", "#FFFFFF", "#D91023"], background: BG_WINE, text: "#ffffff" },
  CO: { stripes: ["#FCD116", "#003893", "#CE1126"], background: BG_OLIVE, text: "#ffffff" },
  VE: { stripes: ["#FCD116", "#00247D", "#CF142B"], background: BG_NAVY, text: "#ffffff" },
  EC: { stripes: ["#FFD100", "#0072CE", "#EF3340"], background: BG_OLIVE, text: "#ffffff" },
  BR: { stripes: ["#009C3B", "#FFDF00", "#002776"], background: BG_NAVY, text: "#ffffff" },
  GY: { stripes: ["#009E49", "#FCD116", "#CE1126"], background: BG_FOREST, text: "#ffffff" },
  SR: { stripes: ["#377E3F", "#FFFFFF", "#B40A2D"], background: BG_FOREST, text: "#ffffff" },
  CU: { stripes: ["#002A8F", "#FFFFFF", "#CF142B"], background: BG_NAVY, text: "#ffffff" },
  DO: { stripes: ["#002D62", "#FFFFFF", "#CE1126"], background: BG_NAVY, text: "#ffffff" },
  HT: { stripes: ["#00209F", "#D21034"], background: BG_NAVY, text: "#ffffff" },
  JM: { stripes: ["#009B3A", "#000000", "#FED100"], background: BG_FOREST, text: "#ffffff" },
  PR: { stripes: ["#ED0000", "#FFFFFF", "#0050F0"], background: BG_NAVY, text: "#ffffff" },
  GT: { stripes: ["#4997D0", "#FFFFFF", "#4997D0"], background: BG_NAVY, text: "#ffffff" },
  HN: { stripes: ["#0073CF", "#FFFFFF", "#0073CF"], background: BG_NAVY, text: "#ffffff" },
  SV: { stripes: ["#0F47AF", "#FFFFFF", "#0F47AF"], background: BG_NAVY, text: "#ffffff" },
  NI: { stripes: ["#0067C6", "#FFFFFF", "#0067C6"], background: BG_NAVY, text: "#ffffff" },
  CR: { stripes: ["#002B7F", "#FFFFFF", "#CE1126"], background: BG_NAVY, text: "#ffffff" },
  PA: { stripes: ["#FFFFFF", "#DA121A", "#005AA7"], background: BG_NAVY, text: "#ffffff" },
  BZ: { stripes: ["#003F87", "#CE1126"], background: BG_NAVY, text: "#ffffff" },

  // ========== Ásia / Oceania ==========
  JP: { stripes: ["#FFFFFF", "#BC002D"], background: BG_COAL, text: "#ffffff" },
  CN: { stripes: ["#DE2910", "#FFDE00"], background: BG_COAL, text: "#ffffff" },
  KR: { stripes: ["#FFFFFF", "#CD2E3A", "#0047A0"], background: BG_NAVY, text: "#ffffff" },
  IN: { stripes: ["#FF9933", "#FFFFFF", "#138808"], background: BG_FOREST, text: "#ffffff" },
  AU: { stripes: ["#012169", "#FFFFFF", "#E4002B"], background: BG_NAVY, text: "#ffffff" },
  NZ: { stripes: ["#012169", "#FFFFFF", "#C8102E"], background: BG_NAVY, text: "#ffffff" },
  SG: { stripes: ["#ED2939", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  TH: { stripes: ["#ED1C24", "#FFFFFF", "#241D4F"], background: BG_NAVY, text: "#ffffff" },
  VN: { stripes: ["#DA251D", "#FFFF00"], background: BG_WINE, text: "#ffffff" },
  PH: { stripes: ["#0038A8", "#CE1126", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  ID: { stripes: ["#FF0000", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  MY: { stripes: ["#CC0000", "#FFFFFF", "#000066", "#FFCC00"], background: BG_NAVY, text: "#ffffff" },
  TW: { stripes: ["#FE0000", "#000095", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  HK: { stripes: ["#DE2910", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  MO: { stripes: ["#00785E", "#FFFFFF"], background: BG_TEAL, text: "#ffffff" },
  KH: { stripes: ["#032EA1", "#E00025", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  LA: { stripes: ["#CE1126", "#002868", "#FFFFFF"], background: BG_NAVY, text: "#ffffff" },
  MM: { stripes: ["#FECB00", "#34B233", "#EA2839"], background: BG_FOREST, text: "#ffffff" },
  BD: { stripes: ["#006A4E", "#F42A41"], background: BG_FOREST, text: "#ffffff" },
  PK: { stripes: ["#01411C", "#FFFFFF"], background: BG_FOREST, text: "#ffffff" },
  LK: { stripes: ["#8D153A", "#FFB700", "#005C39"], background: BG_WINE, text: "#ffffff" },
  NP: { stripes: ["#DC143C", "#003893", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  BT: { stripes: ["#FFCD00", "#FF4E12"], background: BG_OLIVE, text: "#ffffff" },
  MV: { stripes: ["#D21034", "#007E3A", "#FFFFFF"], background: BG_FOREST, text: "#ffffff" },
  MN: { stripes: ["#C4272F", "#015197", "#C4272F"], background: BG_NAVY, text: "#ffffff" },
  AF: { stripes: ["#000000", "#D32011", "#007A36"], background: BG_COAL, text: "#ffffff" },
  IR: { stripes: ["#239F40", "#FFFFFF", "#DA0000"], background: BG_FOREST, text: "#ffffff" },

  // ========== Oriente Médio ==========
  AE: { stripes: ["#00732F", "#FFFFFF", "#000000", "#FF0000"], background: BG_FOREST, text: "#ffffff" },
  SA: { stripes: ["#006C35", "#FFFFFF"], background: BG_FOREST, text: "#ffffff" },
  IL: { stripes: ["#FFFFFF", "#0038B8"], background: BG_NAVY, text: "#ffffff" },
  TR: { stripes: ["#E30A17", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  LB: { stripes: ["#ED1C24", "#FFFFFF", "#00A651"], background: BG_WINE, text: "#ffffff" },
  JO: { stripes: ["#000000", "#FFFFFF", "#007A3D", "#CE1126"], background: BG_COAL, text: "#ffffff" },
  SY: { stripes: ["#CE1126", "#FFFFFF", "#000000"], background: BG_WINE, text: "#ffffff" },
  IQ: { stripes: ["#CE1126", "#FFFFFF", "#000000"], background: BG_WINE, text: "#ffffff" },
  KW: { stripes: ["#007A3D", "#FFFFFF", "#CE1126", "#000000"], background: BG_FOREST, text: "#ffffff" },
  YE: { stripes: ["#CE1126", "#FFFFFF", "#000000"], background: BG_WINE, text: "#ffffff" },
  OM: { stripes: ["#FFFFFF", "#DB161B", "#008000"], background: BG_WINE, text: "#ffffff" },
  PS: { stripes: ["#000000", "#FFFFFF", "#007A3D"], background: BG_COAL, text: "#ffffff" },
  BH: { stripes: ["#FFFFFF", "#DA291C"], background: BG_WINE, text: "#ffffff" },
  QA: { stripes: ["#FFFFFF", "#8A1538"], background: BG_PLUM, text: "#ffffff" },

  // ========== África ==========
  EG: { stripes: ["#CE1126", "#FFFFFF", "#000000"], background: BG_COAL, text: "#ffffff" },
  ZA: { stripes: ["#007749", "#FFB81C", "#001489", "#E03C31"], background: BG_FOREST, text: "#ffffff" },
  NG: { stripes: ["#008751", "#FFFFFF", "#008751"], background: BG_FOREST, text: "#ffffff" },
  KE: { stripes: ["#000000", "#FFFFFF", "#BB0000", "#006600"], background: BG_COAL, text: "#ffffff" },
  MA: { stripes: ["#C1272D", "#006233"], background: BG_WINE, text: "#ffffff" },
  DZ: { stripes: ["#006233", "#FFFFFF", "#D21034"], background: BG_FOREST, text: "#ffffff" },
  TN: { stripes: ["#E70013", "#FFFFFF"], background: BG_WINE, text: "#ffffff" },
  LY: { stripes: ["#E70013", "#000000", "#239E46"], background: BG_COAL, text: "#ffffff" },
  ET: { stripes: ["#078930", "#FCDD09", "#DA121A"], background: BG_FOREST, text: "#ffffff" },
  GH: { stripes: ["#CE1126", "#FCD116", "#006B3F"], background: BG_FOREST, text: "#ffffff" },
  SN: { stripes: ["#00853F", "#FDEF42", "#E31B23"], background: BG_FOREST, text: "#ffffff" },
  CI: { stripes: ["#FF8200", "#FFFFFF", "#009E60"], background: BG_OLIVE, text: "#ffffff" },
  AO: { stripes: ["#CE1126", "#000000"], background: BG_COAL, text: "#ffffff" },
  MZ: { stripes: ["#007168", "#000000", "#FCE100", "#D21034"], background: BG_TEAL, text: "#ffffff" },
  CV: { stripes: ["#003893", "#FFFFFF", "#CF2027"], background: BG_NAVY, text: "#ffffff" },
};

export function getFlagColors(countryCode: string | null | undefined): FlagColors {
  if (!countryCode) return DEFAULT_COLORS;
  return COLORS[countryCode.toUpperCase()] ?? DEFAULT_COLORS;
}
