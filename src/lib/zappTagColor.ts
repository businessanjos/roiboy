// ============ Cor das etiquetas do RoyZapp: um só lugar para legibilidade e fundos ============

export const ZAPP_TAG_FALLBACK_COLOR = "#6b7c85";

export function tagToRgb(hex: string): [number, number, number] {
  const raw = (hex || "").replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  const r = n(0), g = n(2), b = n(4);
  return [Number.isNaN(r) ? 107 : r, Number.isNaN(g) ? 124 : g, Number.isNaN(b) ? 133 : b];
}

/** Texto escuro ou claro conforme a cor da etiqueta, para sempre dar leitura. */
export function tagReadableText(hex: string): string {
  const [r, g, b] = tagToRgb(hex);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.3 ? "#1c1917" : "#ffffff";
}

/** Fundo suave da cor, para blocos e destaques sem brigar com o texto. */
export function tagTint(hex: string, strength = 0.14): string {
  const [r, g, b] = tagToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${strength})`;
}

/** Borda na cor, um pouco mais presente que o fundo. */
export function tagEdge(hex: string, strength = 0.45): string {
  const [r, g, b] = tagToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${strength})`;
}
