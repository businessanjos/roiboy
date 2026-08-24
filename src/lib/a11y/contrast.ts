/**
 * Utilitários de contraste (WCAG 2.1) para tokens HSL do design system.
 *
 * Os tokens do projeto são armazenados como "H S% L%" (sem `hsl()`),
 * então as funções aqui aceitam esse formato diretamente.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Converte um token no formato "27 53% 11%" para RGB 0-255. */
export function hslTokenToRgb(token: string): Rgb {
  const parts = token
    .trim()
    .replace(/hsl\(|\)/g, "")
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 3) {
    throw new Error(`Token HSL inválido: "${token}"`);
  }

  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  if ([h, s, l].some((v) => Number.isNaN(v))) {
    throw new Error(`Token HSL inválido: "${token}"`);
  }

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  const m = l - c / 2;
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

/** Luminância relativa (WCAG). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** Razão de contraste entre dois tokens HSL (1 a 21). */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(hslTokenToRgb(foreground));
  const l2 = relativeLuminance(hslTokenToRgb(background));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type TextScale = "small" | "large";

/**
 * Mínimos WCAG AA:
 * - texto normal (< 18.66px regular / < 24px bold): 4.5:1
 * - texto grande: 3:1
 * - componentes de interface (bordas, ícones, estados): 3:1
 */
export const AA_TEXT_SMALL = 4.5;
export const AA_TEXT_LARGE = 3;
export const AA_NON_TEXT = 3;

export function meetsAaText(
  foreground: string,
  background: string,
  scale: TextScale = "small",
): boolean {
  const min = scale === "large" ? AA_TEXT_LARGE : AA_TEXT_SMALL;
  return contrastRatio(foreground, background) >= min;
}

export function meetsAaNonText(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= AA_NON_TEXT;
}

/** Extrai os tokens `--nome: valor;` de um bloco CSS de um seletor específico. */
export function extractTokens(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css);
  if (!match) throw new Error(`Seletor não encontrado no CSS: ${selector}`);

  const tokens: Record<string, string> = {};
  const re = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(match[1])) !== null) {
    tokens[`--${m[1]}`] = m[2].trim();
  }
  return tokens;
}
