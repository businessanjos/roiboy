import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useCompanyClientList } from "@/hooks/useCompanyClientList";

const mocks = vi.hoisted(() => ({ from: vi.fn(), user: { id: "user-1", account_id: "account-1" } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ currentUser: mocks.user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

const rows = Array.from({ length: 65 }, (_, i) => ({ id: `client-${i}`, products: [{ id: i < 45 ? "cr" : "em" }] }));
let requests: URLSearchParams[];
let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  requests = [];
  const builder: any = {};
  for (const method of ["select", "eq", "order"]) builder[method] = vi.fn(() => builder);
  builder.range = vi.fn(async (from: number) => ({ data: from === 0 ? [{ id: "cr", company_id: "anjos" }, { id: "em", company_id: "eternum" }] : [], error: null }));
  mocks.from.mockReturnValue(builder);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const p = new URL(url).searchParams;
    requests.push(p);
    const offset = Number(p.get("offset"));
    const limit = Number(p.get("limit"));
    return { ok: true, json: async () => ({ clients: rows.slice(offset, offset + limit), total: 65, internal_ids: [] }) };
  }));
});
afterEach(() => { client.clear(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }

describe("Clientes por empresa: lista, contagem e exportação", () => {
  it("Todas usa a paginação existente sem buscar catálogo", async () => {
    const { result } = renderHook(() => useCompanyClientList("all"), { wrapper });
    let page: any;
    await act(async () => { page = await result.current(new URLSearchParams({ limit: "20", offset: "20" })); });
    expect(page.clients[0].id).toBe("client-20");
    expect(page.total).toBe(65);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(requests).toHaveLength(1);
  });
  it("contagem usa todos os clientes da empresa; página seguinte e exportação reutilizam a base", async () => {
    const { result } = renderHook(() => useCompanyClientList("anjos"), { wrapper });
    let first: any, next: any, exported: any;
    await act(async () => {
      first = await result.current(new URLSearchParams({ limit: "20", offset: "0", search: "Maria", contract_filter: "active" }));
      next = await result.current(new URLSearchParams({ limit: "20", offset: "20", search: "Maria", contract_filter: "active" }));
      exported = await result.current(new URLSearchParams({ limit: "200", offset: "0", search: "Maria", contract_filter: "active" }));
    });
    expect(first.total).toBe(45);
    expect(first.clients).toHaveLength(20);
    expect(next.clients[0].id).toBe("client-20");
    expect(exported.clients).toHaveLength(45);
    expect(requests).toHaveLength(2);
    expect(requests.every((p) => p.get("search") === "Maria" && p.get("contract_filter") === "active")).toBe(true);
  });
  it("atualização explícita não reaproveita dados anteriores", async () => {
    const { result } = renderHook(() => useCompanyClientList("anjos"), { wrapper });
    await act(async () => {
      await result.current(new URLSearchParams({ limit: "20", offset: "0" }));
      await result.current(new URLSearchParams({ limit: "20", offset: "0" }), true);
    });
    expect(requests).toHaveLength(4);
  });
  it("erro do serviço não aparece como lista vazia bem-sucedida", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    const { result } = renderHook(() => useCompanyClientList("anjos"), { wrapper });
    await expect(result.current(new URLSearchParams({ limit: "20", offset: "0" }))).rejects.toThrow("Erro ao carregar clientes");
  });
});