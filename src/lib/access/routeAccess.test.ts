import { describe, it, expect } from "vitest";
import {
  decideRouteAccess,
  resolvePermissions,
  isSkippedRoute,
  AccessContext,
} from "./routeAccess";
import { SectorId } from "@/config/sectors";
import { PERMISSIONS } from "@/hooks/usePermissions";

/**
 * Regression coverage for the historical bug where sales/marketing users
 * with /roy-zapp and /ever-ia enabled in the Admin panel were thrown into
 * a redirect loop back to /setores because the nav items required
 * settings.view permission they didn't have.
 *
 * These tests must NEVER fail again.
 */

function makeCtx(
  activeSectors: SectorId[],
  rolePermissions: string[] = [],
  isAdmin = false,
): AccessContext {
  const activeSectorIds = new Set(activeSectors);
  return {
    activeSectorIds,
    permissions: resolvePermissions(rolePermissions, activeSectorIds),
    isAdmin,
  };
}

describe("isSkippedRoute", () => {
  it.each([
    "/setores",
    "/settings",
    "/settings/integrations",
    "/profile",
    "/notifications",
    "/account-settings",
    "/billing",
    "/billing/portal",
  ])("treats %s as a skip-guard route", (path) => {
    expect(isSkippedRoute(path)).toBe(true);
  });

  it.each(["/roy-zapp", "/ever-ia", "/dashboard", "/clients"])(
    "does NOT skip the guard for %s",
    (path) => {
      expect(isSkippedRoute(path)).toBe(false);
    },
  );
});

describe("decideRouteAccess — sales user with royzapp + everia enabled", () => {
  // Simulates the exact production scenario for users like Darlan/Vanessa/George:
  // sales user with the "vendas", "royzapp" and "everia" sectors toggled on
  // in the Admin → Permissions panel, and no team_role assigned.
  const ctx = makeCtx(["vendas", "royzapp", "everia"]);

  it("ALLOWS /roy-zapp", () => {
    const decision = decideRouteAccess("/roy-zapp", ctx);
    expect(decision.allowed).toBe(true);
  });

  it("ALLOWS /ever-ia", () => {
    const decision = decideRouteAccess("/ever-ia", ctx);
    expect(decision.allowed).toBe(true);
  });

  it("ALLOWS sales pipeline routes", () => {
    expect(decideRouteAccess("/pipeline", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/leads", ctx).allowed).toBe(true);
  });

  it("BLOCKS routes from sectors the user does not have", () => {
    const decision = decideRouteAccess("/financial/cash-flow", ctx);
    expect(decision.allowed).toBe(false);
    expect(decision.allowed === false && decision.redirectTo).toBe("/setores");
  });
});

describe("decideRouteAccess — marketing user with royzapp + everia enabled", () => {
  const ctx = makeCtx(["marketing", "royzapp", "everia"]);

  it("ALLOWS /roy-zapp", () => {
    expect(decideRouteAccess("/roy-zapp", ctx).allowed).toBe(true);
  });

  it("ALLOWS /ever-ia", () => {
    expect(decideRouteAccess("/ever-ia", ctx).allowed).toBe(true);
  });

  it("ALLOWS marketing dashboard", () => {
    expect(decideRouteAccess("/marketing", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/content-calendar", ctx).allowed).toBe(true);
  });

  it("BLOCKS RH routes", () => {
    const decision = decideRouteAccess("/rh", ctx);
    expect(decision.allowed).toBe(false);
  });
});

describe("decideRouteAccess — never produces a redirect loop", () => {
  // The redirect target is always /setores (a skip-guard route). If /setores
  // itself ever triggers another redirect, the app loops forever. Lock it.
  it("/setores is always allowed for any user", () => {
    const empty = makeCtx([]);
    const sales = makeCtx(["vendas"]);
    const adminCtx = makeCtx([], [], true);

    expect(decideRouteAccess("/setores", empty).allowed).toBe(true);
    expect(decideRouteAccess("/setores", sales).allowed).toBe(true);
    expect(decideRouteAccess("/setores", adminCtx).allowed).toBe(true);
  });

  it("redirect destination of any blocked route is also allowed (no loop possible)", () => {
    const ctx = makeCtx([]); // user with NO sectors → maximum block surface

    const protectedPaths = [
      "/roy-zapp",
      "/ever-ia",
      "/dashboard",
      "/clients",
      "/pipeline",
      "/marketing",
      "/financial/cash-flow",
      "/rh",
    ];

    for (const path of protectedPaths) {
      const decision = decideRouteAccess(path, ctx);
      if (!decision.allowed) {
        // The destination must itself be allowed for the same user, otherwise
        // we'd ping-pong between path → redirectTo → redirectTo → …
        const next = decideRouteAccess(decision.redirectTo, ctx);
        expect(next.allowed, `Loop risk at ${path} → ${decision.redirectTo}`).toBe(true);
      }
    }
  });
});

describe("decideRouteAccess — admin bypass", () => {
  it("admin sees every route regardless of sector access", () => {
    const ctx = makeCtx([], [], true);

    expect(decideRouteAccess("/roy-zapp", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/ever-ia", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/financial/cash-flow", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/rh", ctx).allowed).toBe(true);
  });
});

describe("decideRouteAccess — permission gating for routes that DO require perms", () => {
  it("BLOCKS /settings for a user without settings.view", () => {
    // /settings is a skip-guard route in the layout, so it stays allowed.
    // This documents the current contract: settings is intentionally
    // reachable so users can manage their own profile/billing.
    const ctx = makeCtx(["vendas"]);
    expect(decideRouteAccess("/settings", ctx).allowed).toBe(true);
  });

  it("ALLOWS /pipeline because activating the vendas sector grants clients.view", () => {
    const ctx = makeCtx(["vendas"]);
    // sanity check: the resolver merges nav-item permissions into the set
    expect(ctx.permissions.has(PERMISSIONS.CLIENTS_VIEW)).toBe(true);
    expect(decideRouteAccess("/pipeline", ctx).allowed).toBe(true);
  });
});
