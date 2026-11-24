import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { AccessLevel, AccessScope } from "@/lib/access/permissionCatalog";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: {
    id: "andreia", auth_user_id: "andreia-auth", account_id: "account",
    role: "gestor", team_role_name: "Admin", is_also_admin: false,
  },
  perms: [] as { module: string; sub_item: string; access_level: AccessLevel; scope: AccessScope }[],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: mocks.user }) }));
vi.mock("@/hooks/useUserPermissions", () => ({
  useUserPermissions: () => ({ perms: mocks.perms, loading: false }),
}));
import { useCsProcessAccess } from "./useCsProcessAccess";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.role = "gestor";
  mocks.user.team_role_name = "Admin";
  mocks.perms = [];
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe("acesso aos Processos do CS", () => {
  it("Andréia pode editar mensagens quando a autorização existente de gestor permite", async () => {
    const { result } = renderHook(useCsProcessAccess, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.rpc).toHaveBeenCalledWith("is_cs_process_editor");
    expect(result.current.canEdit).toBe(true);
  });

  it("Andréia vê todas as clientes do onboarding por padrão, não apenas as próprias", async () => {
    const { result } = renderHook(useCsProcessAccess, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canSeeAll).toBe(true);
    expect(result.current.defaultOwner).toBe("all");
  });

  it("consultora comum permanece sem edição e restrita às próprias clientes", async () => {
    mocks.user.role = "member";
    mocks.user.team_role_name = "Consultor";
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(useCsProcessAccess, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canSeeAll).toBe(false);
    expect(result.current.defaultOwner).toBe("mine");
  });

  it("permissão de ver todas não concede edição das mensagens", async () => {
    mocks.user.role = "member";
    mocks.user.team_role_name = "Consultor";
    mocks.perms = [{ module: "cs", sub_item: "processos_ver_todas", access_level: "view", scope: "all" }];
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(useCsProcessAccess, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canSeeAll).toBe(true);
    expect(result.current.canEdit).toBe(false);
  });

  it("falha ao consultar a autorização nunca libera edição", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    const { result } = renderHook(useCsProcessAccess, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false);
  });
});