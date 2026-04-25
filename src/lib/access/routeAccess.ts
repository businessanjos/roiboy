/**
 * Pure access-decision helpers extracted from AppLayout's route guards.
 *
 * Centralising the logic here lets us unit-test sector + permission gating
 * without rendering the entire app, and prevents regressions like the
 * "/roy-zapp" redirect loop that hit sales users when the permission rules
 * for sector nav items were misconfigured.
 *
 * KEEP THIS IN SYNC with the guards in:
 *   - src/components/layout/AppLayout.tsx (sector guard + permission guard)
 *   - src/hooks/useSectorAccess.tsx (admin/is_also_admin bypass)
 *   - src/hooks/usePermissions.tsx (permission resolution)
 */

import { sectors, getSectorByRoute, routeBelongsToSector, Sector, SectorId } from "@/config/sectors";

// Mirrors the SKIP_GUARD_PATHS allowlist used inside AppLayout — these routes
// are intentionally accessible regardless of sector access (settings, profile,
// notifications, billing…) so they can never trigger a redirect loop.
export const SKIP_GUARD_PATHS = [
  "/setores",
  "/settings",
  "/profile",
  "/notifications",
  "/account-settings",
  "/billing",
] as const;

export function isSkippedRoute(pathname: string): boolean {
  return SKIP_GUARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export interface AccessContext {
  /** Routes the user can reach via /sector navigation in the admin panel */
  activeSectorIds: Set<SectorId>;
  /** Effective permissions resolved from team_roles + sector nav items */
  permissions: Set<string>;
  /** True when role === admin/super_admin OR is_also_admin === true */
  isAdmin: boolean;
}

export type AccessDecision =
  | { allowed: true; reason: string }
  | { allowed: false; redirectTo: string; reason: string };

/**
 * Decide whether the user is allowed to render `pathname`. Mirrors the two
 * <Navigate /> guards in AppLayout: sector guard then permission guard.
 */
export function decideRouteAccess(
  pathname: string,
  ctx: AccessContext,
): AccessDecision {
  if (ctx.isAdmin) {
    return { allowed: true, reason: "admin bypass" };
  }

  if (isSkippedRoute(pathname)) {
    return { allowed: true, reason: "skip-guard route" };
  }

  // Resolve which sector this route belongs to. AppLayout's logic prefers the
  // currently-selected sector when the route belongs to it, then falls back
  // to a route lookup. For the access decision the result is equivalent
  // because sector membership is a function of the route only.
  const routeSector: Sector | undefined = getSectorByRoute(pathname);

  if (!routeSector) {
    // Unknown route — let the router 404; do NOT redirect.
    return { allowed: true, reason: "no sector mapping" };
  }

  if (!ctx.activeSectorIds.has(routeSector.id)) {
    return {
      allowed: false,
      redirectTo: "/setores",
      reason: `sector "${routeSector.id}" not active for user`,
    };
  }

  const item = routeSector.navItems.find((nav) => pathname.startsWith(nav.to));
  if (!item || !item.permission) {
    return { allowed: true, reason: "sector active + no permission required" };
  }

  const required = Array.isArray(item.permission) ? item.permission : [item.permission];
  const hasAny = required.some((p) => ctx.permissions.has(p));
  if (hasAny) {
    return { allowed: true, reason: "permission granted" };
  }

  return {
    allowed: false,
    redirectTo: "/setores",
    reason: `missing permissions: ${required.join(", ")}`,
  };
}

/**
 * Mirrors usePermissions: union of role-derived perms and the perms implied
 * by every active sector's nav items.
 */
export function resolvePermissions(
  rolePermissions: string[],
  activeSectorIds: Iterable<SectorId>,
): Set<string> {
  const merged = new Set<string>(rolePermissions);
  for (const sectorId of activeSectorIds) {
    const sector = sectors.find((s) => s.id === sectorId);
    if (!sector) continue;
    for (const item of sector.navItems) {
      if (!item.permission) continue;
      const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
      perms.forEach((p) => merged.add(p));
    }
  }
  return merged;
}

// Re-exports for tests
export { routeBelongsToSector };
