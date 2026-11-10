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
  usersTotal?: number | null;
  modulesCount?: number | null;
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

/** Pilares do índice de intensidade (0-100). */
export interface ScoreBreakdown { recencia: number; tracao: number; equipe: number; modulos: number; plano: number; total: number }
export const SCORE_MAX = { recencia: 30, tracao: 25, equipe: 20, modulos: 15, plano: 10 } as const;

/** Índice 0-100: recência (30) + tração leads/agenda (25) + adoção da equipe (20) + módulos (15) + plano de ação (10). */
export function usageScoreBreakdown(u: UsageInput, now = Date.now()): ScoreBreakdown {
  const zero = { recencia: 0, tracao: 0, equipe: 0, modulos: 0, plano: 0, total: 0 };
  if (!u.hasAccess) return zero;
  const d = daysSince(u.lastLoginAt, now);
  const recencia = d == null ? 0 : d <= 1 ? 30 : d <= 7 ? 24 : d <= 15 ? 15 : d <= 30 ? 8 : 0;
  const cap = (v: number | null | undefined, max: number, pts: number) => Math.min(pts, (Math.max(0, v ?? 0) / max) * pts);
  const tracao = cap(u.leads30d, 50, 15) + cap((u.appointments30d ?? 0) + (u.consultations30d ?? 0), 40, 10);
  const act = u.activeUsers30d ?? 0;
  const equipe = u.usersTotal && u.usersTotal > 0
    ? cap(act, 5, 10) + Math.min(10, (act / u.usersTotal) * 10)
    : cap(act, 5, 20);
  const modulos = cap(u.modulesCount, 4, 15);
  const plano = u.hasActionPlan ? 10 : 0;
  const total = Math.round(recencia + tracao + equipe + modulos + plano);
  return { recencia, tracao: Math.round(tracao), equipe: Math.round(equipe), modulos: Math.round(modulos), plano, total };
}

export function usageScore(u: UsageInput, now = Date.now()): number {
  return usageScoreBreakdown(u, now).total;
}

export type EngagementLevel = "power" | "engajada" | "moderada" | "baixa";
export function engagementLevel(score: number): EngagementLevel {
  return score >= 75 ? "power" : score >= 50 ? "engajada" : score >= 25 ? "moderada" : "baixa";
}
export const LEVEL_LABEL: Record<EngagementLevel, string> = { power: "Uso intenso", engajada: "Engajada", moderada: "Moderada", baixa: "Baixo uso" };

export const BUCKET_LABEL: Record<UsageBucket, string> = {
  ativa_7d: "Usou nos últimos 7 dias",
  ativa_30d: "Usou entre 8 e 30 dias",
  parada_30d: "Parada há mais de 30 dias",
  nunca: "Liberada, nunca entrou",
  sem_acesso: "Acesso não liberado",
};
