import { startOfDay, endOfDay, isValid, parse, format } from "date-fns";
import type { DatePreset, GlobalFieldFilter } from "@/hooks/useInsightsFilters";

/** Nomes amigáveis na URL ↔ presets internos. Presets relativos são recalculados ao abrir o link. */
export const PRESET_TO_URL: Record<Exclude<DatePreset, "custom">, string> = {
  today: "hoje",
  week: "esta_semana",
  month: "este_mes",
  last_month: "mes_passado",
  quarter: "este_trimestre",
  year: "este_ano",
};
const URL_TO_PRESET: Record<string, DatePreset> = Object.fromEntries(
  Object.entries(PRESET_TO_URL).map(([k, v]) => [v, k as DatePreset]),
);

const UUID = /^[0-9a-f-]{36}$/i;
const FILTER_KEYS = ["periodo", "inicio", "fim", "vendedor", "produto", "funil", "campo"] as const;

export interface UrlFilters {
  preset?: DatePreset;
  startDate?: string;
  endDate?: string;
  userId?: string;
  productId?: string;
  pipelineId?: string;
  globalFieldFilter?: GlobalFieldFilter | null;
}

function parseDay(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : null;
}

function encodeCampo(g: GlobalFieldFilter): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(g))));
}
function decodeCampo(s: string): GlobalFieldFilter | null {
  try {
    const g = JSON.parse(decodeURIComponent(escape(atob(s))));
    if ((g?.source === "deal" || g?.source === "lead") && typeof g?.filter?.fieldId === "string") return g;
  } catch { /* inválido */ }
  return null;
}

/** Lê filtros da URL; parâmetros inválidos são ignorados. */
export function parseUrlFilters(search: string): UrlFilters {
  const p = new URLSearchParams(search);
  const out: UrlFilters = {};
  const periodo = p.get("periodo");
  if (periodo === "personalizado") {
    const a = parseDay(p.get("inicio"));
    const b = parseDay(p.get("fim"));
    if (a && b && a <= b) {
      out.preset = "custom";
      out.startDate = startOfDay(a).toISOString();
      out.endDate = endOfDay(b).toISOString();
    }
  } else if (periodo && URL_TO_PRESET[periodo]) {
    out.preset = URL_TO_PRESET[periodo];
  }
  for (const [key, field] of [["vendedor", "userId"], ["produto", "productId"], ["funil", "pipelineId"]] as const) {
    const v = p.get(key);
    if (v && UUID.test(v)) out[field] = v;
  }
  const campo = p.get("campo");
  if (campo) {
    const g = decodeCampo(campo);
    if (g) out.globalFieldFilter = g;
  }
  return out;
}

/** Escreve filtros na URL preservando parâmetros que não são de filtro. */
export function writeUrlFilters(
  search: string,
  f: { preset: DatePreset; startDate: string; endDate: string; userId: string; productId: string; pipelineId: string; globalFieldFilter?: GlobalFieldFilter | null },
): string {
  const p = new URLSearchParams(search);
  FILTER_KEYS.forEach((k) => p.delete(k));
  if (f.preset === "custom") {
    p.set("periodo", "personalizado");
    p.set("inicio", format(new Date(f.startDate), "yyyy-MM-dd"));
    p.set("fim", format(new Date(f.endDate), "yyyy-MM-dd"));
  } else {
    p.set("periodo", PRESET_TO_URL[f.preset]);
  }
  if (f.userId && f.userId !== "all") p.set("vendedor", f.userId);
  if (f.productId && f.productId !== "all") p.set("produto", f.productId);
  if (f.pipelineId && f.pipelineId !== "all") p.set("funil", f.pipelineId);
  if (f.globalFieldFilter) p.set("campo", encodeCampo(f.globalFieldFilter));
  return p.toString();
}

export interface UrlView { foco: boolean; tv: boolean | null; zoom: number | null; atualizar: number | null }

export function parseUrlView(search: string): UrlView {
  const p = new URLSearchParams(search);
  const z = Number(p.get("zoom"));
  const a = Number(p.get("atualizar"));
  const tv = p.get("tv");
  return {
    foco: p.get("foco") === "1",
    tv: tv === "1" ? true : tv === "0" ? false : null,
    zoom: Number.isFinite(z) && z >= 30 && z <= 250 ? Math.round(z) : null,
    atualizar: Number.isFinite(a) && a >= 1 && a <= 1440 ? a : null,
  };
}

export function writeUrlView(search: string, v: { foco: boolean; tv: boolean; zoom: number }): string {
  const p = new URLSearchParams(search);
  p.set("setor", "vendas");
  if (v.foco) {
    p.set("foco", "1");
    p.set("tv", v.tv ? "1" : "0");
    if (v.tv) p.delete("zoom"); else p.set("zoom", String(v.zoom));
  } else {
    p.delete("foco"); p.delete("tv"); p.delete("zoom");
  }
  return p.toString();
}

/** Troca a query da URL sem recarregar nem criar entrada no histórico. */
export function replaceSearch(next: string) {
  const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, "", url);
  }
}
