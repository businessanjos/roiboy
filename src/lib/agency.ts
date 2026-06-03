/**
 * Helpers for the Traffic Agencies feature.
 *
 * An "agency user" is an internal user with the team role "Agência de Tráfego"
 * — they only see data scoped to their bound agency_id.
 */

export const AGENCY_TEAM_ROLE_NAME = "Agência de Tráfego";

export interface UserLike {
  team_role_name?: string;
  team_role_names?: string[];
  role?: string;
  is_also_admin?: boolean;
}

export function isTrafficAgencyUser(user?: UserLike | null): boolean {
  if (!user) return false;
  // Admins are never treated as agency-restricted, even if also tagged
  if (user.role === "admin" || user.is_also_admin) return false;
  const names = [
    user.team_role_name,
    ...(user.team_role_names ?? []),
  ].filter(Boolean) as string[];
  return names.includes(AGENCY_TEAM_ROLE_NAME);
}

export const MATERIAL_REQUEST_CATEGORIES = [
  { value: "criativo_estatico", label: "Criativo estático" },
  { value: "video", label: "Vídeo" },
  { value: "copy", label: "Copy" },
  { value: "landing_page", label: "Landing page" },
  { value: "outro", label: "Outro" },
] as const;

export type MaterialRequestCategory = (typeof MATERIAL_REQUEST_CATEGORIES)[number]["value"];

export const MATERIAL_REQUEST_STATUSES = [
  { value: "aberto", label: "Aberto", color: "#64748b" },
  { value: "em_producao", label: "Em produção", color: "#f59e0b" },
  { value: "em_revisao", label: "Em revisão", color: "#3b82f6" },
  { value: "entregue", label: "Entregue", color: "#10b981" },
  { value: "cancelado", label: "Cancelado", color: "#ef4444" },
] as const;

export type MaterialRequestStatus = (typeof MATERIAL_REQUEST_STATUSES)[number]["value"];

export function categoryLabel(value: string): string {
  return MATERIAL_REQUEST_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function statusLabel(value: string): string {
  return MATERIAL_REQUEST_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function statusColor(value: string): string {
  return MATERIAL_REQUEST_STATUSES.find((s) => s.value === value)?.color ?? "#64748b";
}
