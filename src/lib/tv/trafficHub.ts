/** Links da Central de Tráfego (sistema externo). */
export const TRAFFIC_HUB_BASE = "https://eternum-luxe-hub.lovable.app";
export type TrafficAgency = { name: string; id: string };
export const DEFAULT_AGENCIES: TrafficAgency[] = [
  { name: "Impulse", id: "impulse" },
  { name: "Social Nudge", id: "social-nudge" },
];
export const PAID_PERIODS = [
  { value: "mes", label: "Este mês" }, { value: "30", label: "Últimos 30 dias" },
  { value: "ano", label: "Este ano" }, { value: "tudo", label: "Todo o período" },
] as const;
export const ORGANIC_PERIODS = [
  { value: "hoje", label: "Hoje" }, { value: "7", label: "7 dias" }, { value: "30", label: "30 dias" },
  { value: "mes", label: "Este mês" }, { value: "ano", label: "Este ano" }, { value: "tudo", label: "Todo o período" },
] as const;
const LEGACY: Record<string, string> = { este_mes: "mes", "30_dias": "30", este_ano: "ano" };

export type TrafficParts = { kind: "paid"; agencia: string; periodo: string } | { kind: "organic"; periodo: string };

function normPeriod(p: string | null, list: readonly { value: string }[]) {
  const v = p ? LEGACY[p] ?? p : "";
  return list.some((x) => x.value === v) ? v : "mes";
}

export function parseTrafficUrl(url: string | null | undefined, agencies: TrafficAgency[] = DEFAULT_AGENCIES): TrafficParts | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.origin !== TRAFFIC_HUB_BASE) return null;
    const path = u.pathname.replace(/\/+$/, "");
    if (path === "/tv") {
      return { kind: "paid", agencia: u.searchParams.get("agencia") || agencies[0]?.id || "", periodo: normPeriod(u.searchParams.get("periodo"), PAID_PERIODS) };
    }
    if (path === "/tv-organico") return { kind: "organic", periodo: normPeriod(u.searchParams.get("periodo"), ORGANIC_PERIODS) };
    return null;
  } catch { return null; }
}

export function buildTrafficUrl(p: TrafficParts): string {
  if (p.kind === "organic") return `${TRAFFIC_HUB_BASE}/tv-organico?periodo=${encodeURIComponent(p.periodo)}`;
  return `${TRAFFIC_HUB_BASE}/tv?agencia=${encodeURIComponent(p.agencia)}&periodo=${encodeURIComponent(p.periodo)}`;
}

export function describeTraffic(p: TrafficParts, agencies: TrafficAgency[] = DEFAULT_AGENCIES): string {
  if (p.kind === "organic") return `Central de Tráfego · Orgânico · ${ORGANIC_PERIODS.find((x) => x.value === p.periodo)?.label ?? "Este mês"}`;
  const ag = agencies.find((a) => a.id === p.agencia)?.name ?? p.agencia;
  return `Central de Tráfego · Pago · ${ag} · ${PAID_PERIODS.find((x) => x.value === p.periodo)?.label ?? "Este mês"}`;
}
