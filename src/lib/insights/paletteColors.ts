/**
 * Utilitários de paleta para os visuais de Insights.
 *
 * Objetivo: garantir que QUALQUER combinação de paleta fique legível e coerente:
 * - Extensão da paleta gerando variações harmônicas (nunca cores genéricas fora do tema).
 * - Texto sobre a cor (barras, funil, pódio) com contraste automático.
 */

function clamp(v: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, v));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clamp(Math.round(v)).toString(16).padStart(2, '0')).join('')}`;
}

/** Luminância relativa (WCAG). */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Cor de texto legível sobre um fundo colorido.
 * Retorna branco em fundos escuros e um grafite escuro em fundos claros.
 */
export function readableTextOn(background?: string): string {
  if (!background) return '#ffffff';
  return relativeLuminance(background) > 0.55 ? '#1f2937' : '#ffffff';
}

/** Clareia (amount > 0) ou escurece (amount < 0) um hex. */
export function shadeColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amount > 0 ? 255 : 0;
  const p = Math.abs(amount);
  return rgbToHex(
    rgb.r + (t - rgb.r) * p,
    rgb.g + (t - rgb.g) * p,
    rgb.b + (t - rgb.b) * p,
  );
}

/**
 * Estende a paleta mantendo a identidade visual: quando faltam cores,
 * gera variações mais claras/escuras das cores originais em vez de
 * introduzir cores aleatórias que quebram a paleta.
 */
export function extendPalette(base: string[], count = 20): string[] {
  const source = base.filter(Boolean);
  if (!source.length) return [];
  const out = [...source];
  const steps = [-0.28, 0.24, -0.5, 0.45, -0.12, 0.12];
  let s = 0;
  while (out.length < count) {
    const amount = steps[s % steps.length];
    for (const c of source) {
      if (out.length >= count) break;
      const next = shadeColor(c, amount);
      if (!out.includes(next)) out.push(next);
    }
    s += 1;
    if (s > steps.length * 2) break;
  }
  // Preenche por ciclo caso ainda falte (paletas muito monocromáticas).
  let i = 0;
  while (out.length < count) {
    out.push(out[i % out.length]);
    i += 1;
  }
  return out;
}

/** Cor da paleta na posição informada, com extensão harmônica automática. */
export function paletteColorAt(base: string[], index: number): string {
  const extended = extendPalette(base, Math.max(base.length, index + 1));
  return extended[index % extended.length];
}
