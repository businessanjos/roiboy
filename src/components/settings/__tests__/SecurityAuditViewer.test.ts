import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => {
      throw new Error("tabela inesperada no mock");
    },
  },
}));

const { fetchSecurityAuditPage } = await import("../SecurityAuditViewer");

describe("fetchSecurityAuditPage — linhas e total vêm da MESMA chamada a search_security_audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("faz uma única chamada à RPC e deriva o total de total_count da primeira linha (sem segunda busca p/ contagem)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { id: "s1", event_type: "login_success", user_id: "u1", account_id: "acc-1", ip_address: "1.1.1.1", user_agent: null, details: {}, created_at: "2026-01-01T00:00:00Z", total_count: 35 },
        { id: "s2", event_type: "login_success", user_id: "u2", account_id: "acc-1", ip_address: "2.2.2.2", user_agent: null, details: {}, created_at: "2026-01-02T00:00:00Z", total_count: 35 },
      ],
      error: null,
    });

    const result = await fetchSecurityAuditPage({
      eventTypeFilter: "login_success",
      search: "joão",
      offset: 10,
      limit: 20,
    });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("search_security_audit", {
      p_event_type: "login_success",
      p_search: "joão",
      p_offset: 10,
      p_limit: 20,
    });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(35);
  });

  it("usa a mesma busca (texto e filtro de tipo) tanto para as linhas retornadas quanto para o total", async () => {
    const search = "evento-x";
    const eventTypeFilter = "admin_action";
    rpcMock.mockResolvedValue({
      data: [{ id: "s1", event_type: "admin_action", user_id: null, account_id: "acc-1", ip_address: null, user_agent: null, details: {}, created_at: "2026-01-01T00:00:00Z", total_count: 1 }],
      error: null,
    });

    await fetchSecurityAuditPage({ eventTypeFilter, search, offset: 0, limit: 10 });

    const callArgs = rpcMock.mock.calls[0][1];
    // A mesma string de busca e o mesmo filtro de tipo usados para montar as
    // linhas são os mesmos que determinam o total_count embutido nelas.
    expect(callArgs.p_search).toBe(search);
    expect(callArgs.p_event_type).toBe(eventTypeFilter);
  });

  it("mapeia filtro 'all' para null e trata total 0 quando não há linhas", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchSecurityAuditPage({
      eventTypeFilter: "all",
      search: "",
      offset: 0,
      limit: 20,
    });

    expect(rpcMock).toHaveBeenCalledWith("search_security_audit", {
      p_event_type: null,
      p_search: null,
      p_offset: 0,
      p_limit: 20,
    });
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it("propaga erro da RPC (não retorna linhas/; total parciais como sucesso)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("falha de rede") });

    await expect(
      fetchSecurityAuditPage({ eventTypeFilter: "all", search: "", offset: 0, limit: 20 }),
    ).rejects.toThrow("falha de rede");
  });
});
