/**
 * Quem pode abrir o dashboard de produtividade do ROY zAPP.
 *
 * Regra aprovada pela liderança (11/08/2026): apenas **admins de conta** e
 * **Heads reais**. Cargos administrativos genéricos (ex.: "Administrativo") e
 * usuários `member` com cargo "Admin" NÃO entram.
 *
 * A mesma regra é replicada no banco em `public.zapp_can_view_analytics()` —
 * alterar os dois juntos.
 */
export interface ZappAnalyticsUser {
  role?: string | null;
  is_also_admin?: boolean | null;
  team_role_name?: string | null;
  team_role_names?: string[] | null;
}

const HEAD_KEYWORDS = ["head", "diretor", "sócio", "socio"];

function roleNames(user: ZappAnalyticsUser): string[] {
  const list = [
    ...(user.team_role_names ?? []),
    ...(user.team_role_name ? [user.team_role_name] : []),
  ];
  return list.filter(Boolean).map((n) => n.toLowerCase());
}

export function canViewZappAnalytics(user: ZappAnalyticsUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin" || user.role === "super_admin") return true;
  if (user.is_also_admin === true) return true;

  const names = roleNames(user);
  if (names.some((n) => HEAD_KEYWORDS.some((k) => n.includes(k)))) return true;
  // Gestor com cargo Admin (ex.: Andréia) — gestor "Administrativo" não entra.
  if (user.role === "gestor" && names.some((n) => n.startsWith("admin") && !n.startsWith("administrativo"))) {
    return true;
  }
  return false;
}
