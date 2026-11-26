/**
 * Selos de cargo exibidos na aba Equipe do RoyZapp.
 *
 * A pessoa pode ter vários cargos (marcados em Configurações > Equipe). O selo
 * segue essa lista; o cargo principal antigo só entra quando a lista está vazia.
 */
export interface TeamRoleBadge {
  id: string;
  name: string;
  color: string;
}

type MaybeRole = Partial<TeamRoleBadge> | null | undefined;

export function resolveTeamRoleBadges(
  assignedRoles: MaybeRole[] | null | undefined,
  legacyPrimary: MaybeRole,
): TeamRoleBadge[] {
  const seen = new Set<string>();
  const out: TeamRoleBadge[] = [];
  const push = (role: MaybeRole) => {
    if (!role?.id || !role.name || seen.has(role.id)) return;
    seen.add(role.id);
    out.push({ id: role.id, name: role.name, color: role.color || "#6b7280" });
  };
  (assignedRoles ?? []).forEach(push);
  if (out.length === 0) push(legacyPrimary);
  return out;
}
