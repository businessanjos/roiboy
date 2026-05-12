/**
 * Detecta se o usuário possui cargo de gestão (Head, Gerente, Diretor,
 * C-level, Sócio) — usado para liberar dashboards executivos.
 *
 * Admins (admin / super_admin / is_also_admin) sempre passam.
 */
const MANAGEMENT_KEYWORDS = [
  "head",
  "gerente",
  "manager",
  "diretor",
  "director",
  "c-level",
  "clevel",
  "ceo",
  "coo",
  "cto",
  "cfo",
  "cmo",
  "cpo",
  "cro",
  "cso",
  "sócio",
  "socio",
  "partner",
];

function nameMatchesManagement(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return MANAGEMENT_KEYWORDS.some((k) => lower.includes(k));
}

export interface ManagementRoleUser {
  role?: string | null;
  is_also_admin?: boolean | null;
  team_role_name?: string | null;
  team_role_names?: string[] | null;
}

export function isManagementUser(
  user: ManagementRoleUser | null | undefined,
  isSuperAdmin = false
): boolean {
  if (!user) return false;
  if (isSuperAdmin) return true;
  if (user.role === "admin" || user.role === "super_admin") return true;
  if (user.is_also_admin) return true;

  if (nameMatchesManagement(user.team_role_name)) return true;
  if (Array.isArray(user.team_role_names)) {
    return user.team_role_names.some((n) => nameMatchesManagement(n));
  }
  return false;
}
