import { renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSectorNavItems } from "../useSectorNavItems";
import { sectors } from "@/config/sectors";
import { decideRouteAccess, resolvePermissions } from "@/lib/access/routeAccess";

const state = vi.hoisted(() => ({ role: "Comercial · Closer" }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { name: "Darlan Ferreira", role: "member", team_role_name: state.role } }) }));
vi.mock("@/hooks/useSuperAdmin", () => ({ useSuperAdmin: () => ({ isSuperAdmin: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true, isAdmin: false, loading: false }) }));
vi.mock("@/contexts/SectorContext", () => ({ useSector: () => ({ currentSector: null }) }));
vi.mock("@/hooks/useUserPermissions", () => ({ useUserPermissions: () => ({ isAdmin: false, perms: [
  { module: "comercial", sub_item: "ranking", access_level: "none" },
  { module: "comercial", sub_item: "leads", access_level: "view" },
] }) }));
afterEach(cleanup);
it.each(["Comercial · Closer", "Comercial · SDR"])("shows the request queue without management for %s", (role) => {
  state.role = role;
  const sales = sectors.find((s) => s.id === "vendas");
  const { result } = renderHook(() => useSectorNavItems(sales));
  const paths = result.current.map((item) => item.to);
  expect(paths).toContain("/sales-team/transfer-requests");
  expect(paths).not.toContain("/sales-team");
});
it("opens the personal queue with sales access without granting team management", () => {
  const context = { activeSectorIds: new Set<"vendas">(["vendas"]), permissions: resolvePermissions([], ["vendas"]), isAdmin: false };
  expect(decideRouteAccess("/sales-team/transfer-requests", context).allowed).toBe(true);
  expect(decideRouteAccess("/sales-team", context).allowed).toBe(false);
});