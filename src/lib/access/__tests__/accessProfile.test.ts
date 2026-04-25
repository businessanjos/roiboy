/**
 * Testes do motor de permissões para Perfis de Acesso
 * (Admin / Gestor / Membro / Viewer)
 *
 * Garante que ao trocar o perfil de acesso:
 *  - Admin libera tudo (bypass)
 *  - Viewer/Member/Gestor são restringidos pelas permissões reais
 *  - As decisões de rota mudam imediatamente conforme o conjunto de
 *    sectors + permissions resolvido pelo usePermissions
 *  - Sector access NUNCA concede permissões de gestão
 */
import { describe, it, expect } from "vitest";
import {
  decideRouteAccess,
  resolvePermissions,
  type AccessContext,
} from "@/lib/access/routeAccess";
import { PERMISSIONS } from "@/lib/access/permissions";
import type { SectorId } from "@/config/sectors";

// ---------------------------------------------------------------------------
// Helpers — modelam o que o usePermissions/useSectorAccess produzem para cada
// perfil de acesso depois que o Super Admin troca o `users.role`.
// ---------------------------------------------------------------------------

type Profile = "admin" | "gestor" | "member" | "viewer";

interface BuildCtxOptions {
  profile: Profile;
  /** Sectors liberados no painel admin (ignorado para admin — admin bypassa). */
  activeSectors?: SectorId[];
  /** Permissões vindas dos team_roles atribuídos ao usuário. */
  rolePermissions?: string[];
}

function buildContext({
  profile,
  activeSectors = [],
  rolePermissions = [],
}: BuildCtxOptions): AccessContext {
  const isAdmin = profile === "admin";
  const activeSectorIds = new Set<SectorId>(activeSectors);
  const permissions = isAdmin
    ? new Set<string>(Object.values(PERMISSIONS))
    : resolvePermissions(rolePermissions, activeSectorIds);
  return { activeSectorIds, permissions, isAdmin };
}

// ---------------------------------------------------------------------------
// 1. Bypass de Admin
// ---------------------------------------------------------------------------
describe("Perfil de Acesso: Admin", () => {
  const ctx = buildContext({ profile: "admin" });

  it.each([
    "/dashboard",
    "/clients",
    "/sales-team",
    "/financial/cash-flow",
    "/roy-zapp",
    "/rh/collaborators",
    "/settings",
  ])("admin libera %s sem precisar de sector ou permissão", (route) => {
    const decision = decideRouteAccess(route, ctx);
    expect(decision.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Viewer — apenas leitura
// ---------------------------------------------------------------------------
describe("Perfil de Acesso: Viewer", () => {
  it("viewer SEM sectors ativos é redirecionado para /setores em rotas restritas", () => {
    const ctx = buildContext({ profile: "viewer" });

    const decision = decideRouteAccess("/dashboard", ctx);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.redirectTo).toBe("/setores");
    }
  });

  it("viewer COM sector Operações ativo + permission CLIENTS_VIEW abre /clients", () => {
    const ctx = buildContext({
      profile: "viewer",
      activeSectors: ["operacoes"],
      // sector access já injeta CLIENTS_VIEW via resolvePermissions
    });

    const decision = decideRouteAccess("/clients", ctx);
    expect(decision.allowed).toBe(true);
  });

  it("viewer com sector Vendas NUNCA recebe TEAM_VIEW (gestão)", () => {
    const ctx = buildContext({
      profile: "viewer",
      activeSectors: ["vendas"],
    });

    // /sales-team exige TEAM_VIEW que é management-only — sector não concede
    const decision = decideRouteAccess("/sales-team", ctx);
    expect(decision.allowed).toBe(false);
    expect(ctx.permissions.has(PERMISSIONS.TEAM_VIEW)).toBe(false);
  });

  it("viewer pode acessar rotas SKIP_GUARD mesmo sem sectors", () => {
    const ctx = buildContext({ profile: "viewer" });

    expect(decideRouteAccess("/settings", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/profile", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/notifications", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/setores", ctx).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Membro — uso padrão (depende dos sectors liberados pelo Super Admin)
// ---------------------------------------------------------------------------
describe("Perfil de Acesso: Membro", () => {
  it("membro com sector Vendas ativo abre /pipeline", () => {
    const ctx = buildContext({
      profile: "member",
      activeSectors: ["vendas"],
    });

    expect(decideRouteAccess("/pipeline", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/leads", ctx).allowed).toBe(true);
  });

  it("membro SEM sector Financeiro NÃO abre /financial/cash-flow", () => {
    const ctx = buildContext({
      profile: "member",
      activeSectors: ["operacoes"],
    });

    const decision = decideRouteAccess("/financial/cash-flow", ctx);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.redirectTo).toBe("/setores");
    }
  });

  it("membro com sector Vendas NÃO recebe gestão (/sales-team)", () => {
    const ctx = buildContext({
      profile: "member",
      activeSectors: ["vendas"],
    });

    expect(decideRouteAccess("/sales-team", ctx).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Gestor — sectors + team_roles concedem permissões de gestão
// ---------------------------------------------------------------------------
describe("Perfil de Acesso: Gestor", () => {
  it("gestor com TEAM_VIEW via team_role abre /sales-team", () => {
    const ctx = buildContext({
      profile: "gestor",
      activeSectors: ["vendas"],
      rolePermissions: [PERMISSIONS.TEAM_VIEW, PERMISSIONS.CLIENTS_VIEW],
    });

    expect(decideRouteAccess("/sales-team", ctx).allowed).toBe(true);
    expect(decideRouteAccess("/pipeline", ctx).allowed).toBe(true);
  });

  it("gestor SEM TEAM_VIEW (apenas sector Vendas) NÃO abre /sales-team", () => {
    const ctx = buildContext({
      profile: "gestor",
      activeSectors: ["vendas"],
      // sem TEAM_VIEW explícito no team_role
    });

    expect(decideRouteAccess("/sales-team", ctx).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Reatividade — trocar o perfil deve mudar IMEDIATAMENTE as decisões.
//    Simulamos a sequência de re-resoluções que o PermissionsProvider faz
//    após o Super Admin alterar `users.role`.
// ---------------------------------------------------------------------------
describe("Troca de Perfil: efeito imediato no motor de permissões", () => {
  const sectors: SectorId[] = ["operacoes", "vendas"];
  const teamRolePerms = [PERMISSIONS.CLIENTS_VIEW];

  it("admin → viewer revoga acesso a /sales-team na próxima resolução", () => {
    const adminCtx = buildContext({ profile: "admin" });
    expect(decideRouteAccess("/sales-team", adminCtx).allowed).toBe(true);

    // Após o Super Admin trocar o role para viewer:
    const viewerCtx = buildContext({
      profile: "viewer",
      activeSectors: sectors,
      rolePermissions: teamRolePerms,
    });
    expect(decideRouteAccess("/sales-team", viewerCtx).allowed).toBe(false);
  });

  it("viewer → admin libera todas as rotas restritas anteriores", () => {
    const viewerCtx = buildContext({ profile: "viewer" });
    expect(decideRouteAccess("/financial/cash-flow", viewerCtx).allowed).toBe(false);
    expect(decideRouteAccess("/rh/collaborators", viewerCtx).allowed).toBe(false);

    const adminCtx = buildContext({ profile: "admin" });
    expect(decideRouteAccess("/financial/cash-flow", adminCtx).allowed).toBe(true);
    expect(decideRouteAccess("/rh/collaborators", adminCtx).allowed).toBe(true);
  });

  it("gestor → membro perde permissão de gestão (TEAM_VIEW) imediatamente", () => {
    const gestorCtx = buildContext({
      profile: "gestor",
      activeSectors: ["vendas"],
      rolePermissions: [PERMISSIONS.TEAM_VIEW, PERMISSIONS.CLIENTS_VIEW],
    });
    expect(decideRouteAccess("/sales-team", gestorCtx).allowed).toBe(true);

    // Super Admin rebaixa para membro e remove o team_role de gestão:
    const memberCtx = buildContext({
      profile: "member",
      activeSectors: ["vendas"],
      rolePermissions: [PERMISSIONS.CLIENTS_VIEW],
    });
    expect(decideRouteAccess("/sales-team", memberCtx).allowed).toBe(false);
    expect(decideRouteAccess("/pipeline", memberCtx).allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. resolvePermissions — invariantes de segurança
// ---------------------------------------------------------------------------
describe("resolvePermissions: invariantes de segurança", () => {
  it("mescla permissões de team_roles com permissões base de sectors", () => {
    const perms = resolvePermissions(
      [PERMISSIONS.REPORTS_VIEW],
      new Set<SectorId>(["operacoes"]),
    );
    expect(perms.has(PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(perms.has(PERMISSIONS.CLIENTS_VIEW)).toBe(true);
  });

  it("sector access NUNCA injeta TEAM_VIEW, TEAM_EDIT ou SETTINGS_EDIT", () => {
    const perms = resolvePermissions(
      [],
      new Set<SectorId>(["operacoes", "vendas", "configuracoes"]),
    );
    expect(perms.has(PERMISSIONS.TEAM_VIEW)).toBe(false);
    expect(perms.has(PERMISSIONS.TEAM_EDIT)).toBe(false);
    expect(perms.has(PERMISSIONS.SETTINGS_EDIT)).toBe(false);
  });

  it("permissões de gestão precisam vir explicitamente do team_role", () => {
    const perms = resolvePermissions(
      [PERMISSIONS.TEAM_VIEW, PERMISSIONS.SETTINGS_EDIT],
      new Set<SectorId>(["vendas"]),
    );
    expect(perms.has(PERMISSIONS.TEAM_VIEW)).toBe(true);
    expect(perms.has(PERMISSIONS.SETTINGS_EDIT)).toBe(true);
  });
});
