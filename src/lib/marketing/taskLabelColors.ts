import type { CSSProperties } from "react";

// Keep these identities unchanged for legacy labels and the separate cover picker.
export const TASK_LABEL_COLORS = [
  { value: "blue", name: "Azul", hex: "#2069a2", swatch: "bg-task-label-blue", badge: "bg-task-label-blue/10 text-task-label-blue border-transparent" },
  { value: "green", name: "Verde", hex: "#207449", swatch: "bg-task-label-green", badge: "bg-task-label-green/10 text-task-label-green border-transparent" },
  { value: "yellow", name: "Amarelo", hex: "#906211", swatch: "bg-task-label-yellow", badge: "bg-task-label-yellow/10 text-task-label-yellow border-transparent" },
  { value: "red", name: "Vermelho", hex: "#a92732", swatch: "bg-task-label-red", badge: "bg-task-label-red/10 text-task-label-red border-transparent" },
  { value: "purple", name: "Roxo", hex: "#6e3b9f", swatch: "bg-task-label-purple", badge: "bg-task-label-purple/10 text-task-label-purple border-transparent" },
  { value: "gray", name: "Cinza", hex: "#586271", swatch: "bg-task-label-gray", badge: "bg-task-label-gray/10 text-task-label-gray border-transparent" },
] as const;

export type TaskLabelColor = typeof TASK_LABEL_COLORS[number]["value"] | `#${string}`;
export const TASK_LABEL_PALETTE: ReadonlyArray<{ value: TaskLabelColor; name: string }> = [
  ...TASK_LABEL_COLORS,
  { value: "#ea580c", name: "Laranja" }, { value: "#be185d", name: "Rosa" },
  { value: "#0891b2", name: "Ciano" }, { value: "#0f766e", name: "Turquesa" },
  { value: "#4d7c0f", name: "Lima" }, { value: "#15803d", name: "Esmeralda" },
  { value: "#4338ca", name: "Índigo" }, { value: "#0369a1", name: "Azul-petróleo" },
  { value: "#a21caf", name: "Magenta" }, { value: "#9f1239", name: "Vinho" },
  { value: "#b45309", name: "Cobre" }, { value: "#78716c", name: "Grafite" },
];

export function normalizeTaskLabelHex(value: unknown): `#${string}` | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex as `#${string}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) return `#${hex.slice(1).split("").map(char => char + char).join("")}`;
  return null;
}

type LabelColorAppearance = {
  value: TaskLabelColor; name: string; hex: string; swatch: string; badge: string; style?: CSSProperties;
};

function colorLuminance(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = lightness - chroma / 2;
  const rgb = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  const linear = rgb.map(channel => { const value = channel + offset; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

/** Keep the swatch exact; adapt only text lightness to the existing light/dark surfaces. */
function readableLightness(hue: number, saturation: number, original: number) {
  let light = Math.min(original, 0.4), dark = Math.max(original, 0.65);
  while (light > 0 && colorLuminance(hue, saturation, light) > 0.13) light = Math.max(0, light - 0.01);
  while (dark < 1 && colorLuminance(hue, saturation, dark) < 0.55) dark = Math.min(1, dark + 0.01);
  return { light, dark };
}

/** User colors are data, passed to theme tokens as validated HSL channels only. */
export function labelColor(value: unknown): LabelColorAppearance {
  const preset = TASK_LABEL_COLORS.find(option => option.value === value);
  if (preset) return preset;
  const hex = normalizeTaskLabelHex(value);
  if (!hex) return TASK_LABEL_COLORS[0];
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
  const lightness = (high + low) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const hue = delta === 0 ? 0 : ((high === r ? (g - b) / delta : high === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
  const readable = readableLightness(hue, saturation, lightness);
  return {
    value: hex, hex, name: TASK_LABEL_PALETTE.find(option => option.value === hex)?.name ?? "Personalizada",
    swatch: "bg-task-label-custom-swatch", badge: "bg-task-label-custom/10 text-task-label-custom border-transparent",
    style: { "--task-label-custom-h": hue.toFixed(2), "--task-label-custom-s": `${(saturation * 100).toFixed(2)}%`, "--task-label-custom-l": `${(lightness * 100).toFixed(2)}%`, "--task-label-custom-light-l": `${(readable.light * 100).toFixed(2)}%`, "--task-label-custom-dark-l": `${(readable.dark * 100).toFixed(2)}%` } as CSSProperties,
  };
}