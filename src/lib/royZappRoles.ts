/**
 * Papéis efetivos DENTRO do ROY zAPP (derivados de `user_sector_access.role_in_sector`).
 *
 * - admin   → vê todas as conversas do setor, transfere, responde, gerencia
 * - manager → vê todas as conversas do setor (fila + atribuídas), transfere e responde
 * - member  → vê apenas as conversas atribuídas a ele + a fila (para assumir), responde e transfere
 * - viewer  → somente leitura: não responde, não transfere, não assume
 */
export type ZappSectorRole = "admin" | "manager" | "member" | "viewer";

export interface ZappRoleCapabilities {
  /** Enxerga conversas atribuídas a outros atendentes do setor. */
  canSeeAllSectorConversations: boolean;
  /** Pode transferir conversas para outro atendente/departamento. */
  canTransfer: boolean;
  /** Pode enviar mensagens (texto, mídia, áudio). */
  canReply: boolean;
  /** Pode assumir da fila / devolver para a fila / mudar status. */
  canClaim: boolean;
  /** Pode criar/editar tags e aplicar tags em conversas. */
  canEditTags: boolean;
  /** Pode gerenciar a conexão do WhatsApp (QR Code, reset, webhook). */
  canManageConnection: boolean;
}

interface ResolveArgs {
  /** Admin de conta / super admin / is_also_admin. */
  isAccountAdmin?: boolean;
  /** Cargo de gestão (Head, Diretor, C-level, Sócio, Gestor...). */
  isManagement?: boolean;
  sectorId?: string | null;
  sectorAccess?: { sector_id: string; role_in_sector?: string | null; is_active?: boolean }[];
}

const VALID_ROLES: ZappSectorRole[] = ["admin", "manager", "member", "viewer"];

export function resolveZappSectorRole({
  isAccountAdmin,
  isManagement,
  sectorId,
  sectorAccess,
}: ResolveArgs): ZappSectorRole {
  if (isAccountAdmin) return "admin";

  const raw = sectorId
    ? sectorAccess?.find((a) => a.sector_id === sectorId && a.is_active !== false)?.role_in_sector
    : null;
  const role = (raw && VALID_ROLES.includes(raw as ZappSectorRole) ? raw : null) as ZappSectorRole | null;

  // Cargo de gestão nunca cai abaixo de "manager" (mas um viewer explícito é respeitado).
  if (role === "viewer") return "viewer";
  if (isManagement) return role === "admin" ? "admin" : "manager";

  return role ?? "member";
}

export function zappRoleCapabilities(role: ZappSectorRole): ZappRoleCapabilities {
  switch (role) {
    case "admin":
    case "manager":
      return {
        canSeeAllSectorConversations: true,
        canTransfer: true,
        canReply: true,
        canClaim: true,
        canEditTags: true,
        canManageConnection: true,
      };
    case "viewer":
      return {
        canSeeAllSectorConversations: false,
        canTransfer: false,
        canReply: false,
        canClaim: false,
        canEditTags: false,
        canManageConnection: false,
      };
    case "member":
    default:
      return {
        canSeeAllSectorConversations: false,
        // Membro pode transferir as conversas que atende (não fica preso a um chat).
        canTransfer: true,
        canReply: true,
        canClaim: true,
        canEditTags: true,
        canManageConnection: false,
      };
  }
}

export const ZAPP_ROLE_LABELS: Record<ZappSectorRole, string> = {
  admin: "Admin",
  manager: "Gestor",
  member: "Membro",
  viewer: "Viewer",
};
