import { isManagementUser, type ManagementRoleUser } from "@/lib/access/managementRoles";

/** Histórico de sequências: gestores e admins veem todos; demais só os próprios envios. */
export function canSeeAllSequenceRuns(user: (ManagementRoleUser & { role?: string | null }) | null | undefined): boolean {
  if (!user) return false;
  if (["gestor", "head", "leader"].includes(user.role || "")) return true;
  return isManagementUser(user);
}
