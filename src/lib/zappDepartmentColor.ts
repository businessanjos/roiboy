// As cores dos departamentos chegam cadastradas como nomes ("primary", "emerald", "amber"),
// não como CSS válido. Sem esta tradução o marcador fica invisível na tela.
const COLOR_MAP: Record<string, string> = {
  primary: "hsl(39 60% 55%)",
  emerald: "hsl(152 55% 45%)",
  amber: "hsl(39 60% 55%)",
  blue: "hsl(217 91% 60%)",
  purple: "hsl(271 81% 56%)",
  slate: "hsl(215 20% 65%)",
  green: "hsl(142 71% 45%)",
  red: "hsl(0 72% 51%)",
  orange: "hsl(25 95% 53%)",
  yellow: "hsl(48 96% 53%)",
  teal: "hsl(172 66% 50%)",
  cyan: "hsl(187 85% 53%)",
  indigo: "hsl(239 84% 67%)",
  pink: "hsl(330 81% 60%)",
};

export function getDepartmentColor(color: string | null | undefined): string {
  const c = (color || "").trim();
  if (!c) return "hsl(var(--zapp-accent))";
  if (c.startsWith("#") || c.startsWith("hsl") || c.startsWith("rgb")) return c;
  return COLOR_MAP[c] || "hsl(var(--zapp-accent))";
}
