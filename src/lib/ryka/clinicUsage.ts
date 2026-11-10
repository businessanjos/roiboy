/** Classificação de uso das clínicas na Ryka (somente leitura, para o painel). */
export type UsageBucket = "ativa_7d" | "ativa_30d" | "parada_30d" | "nunca" | "sem_acesso";

export interface UsageInput {
  hasAccess: boolean;
  lastLoginAt: string | null;
  activeUsers30d?: number | null;
  leads30d?: number | null;
  appointments30d?: number | null;
  consultations30d?: number | null;
  hasActionPlan?: boolean | null;
}

const DAY = 86_400_000;

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : null;
}

export function usageBucket(u: UsageInput, now = Date.now()): UsageBucket {
  if (!u.hasAccess) return "sem_acesso";
  const d = daysSince(u.lastLoginAt, now);
  if (d == null) return "nunca";
  if (d <= 7) return "ativa_7d";
  if (d <= 30) return "ativa_30d";
  return "parada_30d";
}

/** Pontuação 0-100: recência do login (40) + pessoas ativas (20) + leads (15) + agenda/consultas (15) + plano de ação (10). */
export function usageScore(u: UsageInput, now = Date.now()): number {
  if (!u.hasAccess) return 0;
  const d = daysSince(u.lastLoginAt, now);
  const rec = d == null ? 0 : d <= 1 ? 40 : d <= 7 ? 32 : d <= 15 ? 20 : d <= 30 ? 10 : 0;
  const cap = (v: number | null | undefined, max: number, pts: number) => Math.min(pts, ((v ?? 0) / max) * pts);
  const s = rec + cap(u.activeUsers30d, 5, 20) + cap(u.leads30d, 50, 15) + cap((u.appointments30d ?? 0) + (u.consultations30d ?? 0), 40, 15) + (u.hasActionPlan ? 10 : 0);
  return Math.round(s);
}

export const BUCKET_LABEL: Record<UsageBucket, string> = {
  ativa_7d: "Usou nos últimos 7 dias",
  ativa_30d: "Usou entre 8 e 30 dias",
  parada_30d: "Parada há mais de 30 dias",
  nunca: "Liberada, nunca entrou",
  sem_acesso: "Acesso não liberado",
};
