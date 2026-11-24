import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTeamUsers } from "@/hooks/useTeamUsers";
import { useMarketingTeamUsers } from "@/hooks/useMarketingTeamUsers";
import { useSectorUsers } from "@/hooks/useSectorUsers";

const mock = vi.hoisted(() => ({ from: vi.fn(), filters: [] as unknown[][] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: { id: "person", account_id: "account", auth_user_id: "auth-person" } }) }));
const tv = { id: "4cd93864-3689-4835-bddf-91e2960e7860", auth_user_id: "4e6afeac-2c22-4e20-805f-dba140036027", name: "TV Escritório", email: "tv-escritorio@iamroy.app", is_active: true, avatar_url: null };
const jessica = { id: "jessica", auth_user_id: "auth-jessica", name: "Jessica Campos", email: "jessica@example.com", is_active: true, avatar_url: null };
const lucas = { id: "14389b62-d4a1-4837-9aee-61a19b28c383", name: "Lucas dos Santos", email: "lucas@example.com", is_active: true, avatar_url: null };
const support = { id: "4385080f-e707-460f-b7ab-489fa3f73150", name: "Lucas Suporte", email: "support@example.com", is_active: true, avatar_url: null };

beforeEach(() => {
  cleanup(); mock.filters = [];
  mock.from.mockImplementation((table: string) => {
    let excludedId: string | undefined;
    const rows = () => table === "users" ? [tv, jessica, lucas, support].filter((u) => u.id !== excludedId)
      : table === "user_sector_access" ? [tv, jessica, lucas, support].map((user) => ({ user, is_active: true, role_in_sector: "member" })) : [];
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "order", "eq"]) builder[method] = (...args: unknown[]) => { mock.filters.push([table, method, ...args]); return builder; };
    builder.neq = (column: string, value: string) => { if (column === "id") excludedId = value; return builder; };
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve);
    return builder;
  });
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("visible people lists", () => {
  it("all-team selectors exclude the technical TV account, retain other people and auth IDs", async () => {
    const { result } = renderHook(() => useTeamUsers(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((u) => u.name)).toEqual(["Jessica Campos", "Lucas dos Santos", "Lucas Suporte"]);
    expect(result.current.data?.[0].id).toBe("auth-jessica");
    expect(mock.filters).toContainEqual(["users", "eq", "account_id", "account"]);
  });
  it("Marketing excludes TV Escritório and Lucas Suporte, never Lucas dos Santos", async () => {
    const { result } = renderHook(() => useMarketingTeamUsers(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((u) => u.name)).toEqual(["Jessica Campos", "Lucas dos Santos"]);
    expect(result.current.data).toHaveLength(2);
    expect(mock.filters).toContainEqual(["user_sector_access", "eq", "sector_id", "marketing"]);
    expect(mock.filters).toContainEqual(["user_sector_access", "eq", "account_id", "account"]);
  });
  it("sector selectors exclude the TV even when inactive people are requested", async () => {
    const { result } = renderHook(() => useSectorUsers({ sectorId: "marketing", activeOnly: false }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.users.map((u) => u.name)).toEqual(["Jessica Campos", "Lucas dos Santos", "Lucas Suporte"]);
    expect(mock.filters).toContainEqual(["user_sector_access", "eq", "account_id", "account"]);
  });
});