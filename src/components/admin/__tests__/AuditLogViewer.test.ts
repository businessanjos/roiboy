import { describe, it, expect, vi, beforeEach } from "vitest";

// Fixture de exportação com mais de 2 lotes (EXPORT_BATCH_SIZE = 1000): 2537 linhas.
const FIXTURE_SIZE = 2537;
function makeFixture(): import("../AuditLogViewer").UnifiedLog[] {
  return Array.from({ length: FIXTURE_SIZE }, (_, i) => ({
    id: `log-${i}`,
    user_id: `user-${i % 5}`,
    user_name: `Pessoa ${i % 5}`,
    user_email: `pessoa${i % 5}@exemplo.com`,
    action: "update",
    entity_type: "task",
    entity_id: null,
    entity_name: `Registro ${i}`,
    details: null,
    ip_address: null,
    user_agent: null,
    created_at: "2026-01-01T00:00:00Z",
    source: "audit" as const,
    context: null,
  }));
}

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: () => {
      throw new Error("tabela inesperada no mock");
    },
  },
}));

const { mapRpcRowToUnifiedLog, exportAllFiltered, fetchUnifiedPage } = await import("../AuditLogViewer");

describe("mapRpcRowToUnifiedLog — mapeamento da RPC audit_unified_page", () => {
  it("mapeia todos os campos da linha crua da RPC para o formato da tela", () => {
    const row = {
      id: "l1",
      source: "deal" as const,
      user_id: "u1",
      user_name: "Fulano",
      user_email: "fulano@exemplo.com",
      action: "stage_change",
      entity_type: "deal",
      entity_id: "d1",
      entity_name: "Negócio X",
      details: { de: "Proposta", para: "Fechado" },
      ip_address: "1.2.3.4",
      user_agent: "ua",
      created_at: "2026-02-01T10:00:00Z",
      context: "Lead Y › Negócio X",
      description: "Moveu o negócio",
      total_count: 42,
    };
    const mapped = mapRpcRowToUnifiedLog(row);
    expect(mapped).toEqual({
      id: "l1",
      user_id: "u1",
      user_name: "Fulano",
      user_email: "fulano@exemplo.com",
      action: "stage_change",
      entity_type: "deal",
      entity_id: "d1",
      entity_name: "Negócio X",
      details: { de: "Proposta", para: "Fechado" },
      ip_address: "1.2.3.4",
      user_agent: "ua",
      created_at: "2026-02-01T10:00:00Z",
      source: "deal",
      context: "Lead Y › Negócio X",
      description: "Moveu o negócio",
    });
    // total_count não vaza para o objeto exibido na tela
    expect((mapped as any).total_count).toBeUndefined();
  });
});

describe("exportAllFiltered — exportação em lotes (fixture 2537 linhas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acumula todos os lotes até esgotar o conjunto filtrado, sem teto silencioso", async () => {
    const fixture = makeFixture();
    const batchSize = 1000;
    const fetchPage = vi.fn(async (offset: number, limit: number) => {
      const rows = fixture.slice(offset, offset + limit);
      return { rows, total: fixture.length };
    });
    const onProgress = vi.fn();

    const all = await exportAllFiltered(fetchPage, onProgress);

    expect(all).toHaveLength(FIXTURE_SIZE);
    expect(new Set(all.map((r) => r.id)).size).toBe(FIXTURE_SIZE);
    expect(all[0].id).toBe("log-0");
    expect(all[FIXTURE_SIZE - 1].id).toBe(`log-${FIXTURE_SIZE - 1}`);
    // 2537 / 1000 -> 3 lotes (1000, 1000, 537)
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, batchSize);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 1000, batchSize);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 2000, batchSize);
    expect(onProgress).toHaveBeenLastCalledWith({ loaded: FIXTURE_SIZE, total: FIXTURE_SIZE });
  });

  it("propaga erro ocorrido no lote 2 e NÃO retorna arquivo parcial como sucesso", async () => {
    const fixture = makeFixture();
    let call = 0;
    const fetchPage = vi.fn(async (offset: number, limit: number) => {
      call += 1;
      if (call === 2) {
        throw new Error("boom no lote 2");
      }
      const rows = fixture.slice(offset, offset + limit);
      return { rows, total: fixture.length };
    });

    await expect(exportAllFiltered(fetchPage)).rejects.toThrow("boom no lote 2");
    // Chegou a chamar o lote 1 (sucesso) e o lote 2 (erro), mas nunca completou — nada deve ser
    // tratado como exportação bem-sucedida pelo chamador (ele deve capturar o throw).
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("para sem erro quando um lote retorna vazio (segurança contra loop infinito)", async () => {
    const fetchPage = vi.fn(async () => ({ rows: [], total: 100 }));
    const all = await exportAllFiltered(fetchPage);
    expect(all).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe("fetchUnifiedPage — mapeamento de filtros do AuditLogViewer para a RPC audit_unified_page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("repassa todos os filtros da tela como parâmetros p_* da RPC e usa total_count da primeira linha", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "a", source: "audit", user_id: "u1", user_name: "N", user_email: "e",
          action: "update", entity_type: "task", entity_id: null, entity_name: null,
          details: null, ip_address: null, user_agent: null,
          created_at: "2026-01-01T00:00:00Z", total_count: 7,
        },
      ],
      error: null,
    });

    const result = await fetchUnifiedPage({
      accountId: "acc-1",
      scope: "commercial",
      sinceIso: "2026-01-01T00:00:00Z",
      actionFilter: "update",
      entityFilter: "task",
      userFilter: "user-1",
      search: "termo",
      offset: 20,
      limit: 10,
    });

    expect(rpcMock).toHaveBeenCalledWith("audit_unified_page", {
      p_account_id: "acc-1",
      p_from: "2026-01-01T00:00:00Z",
      p_to: null,
      p_scope: "commercial",
      p_action: "update",
      p_entity_type: "task",
      p_user: "user-1",
      p_search: "termo",
      p_offset: 20,
      p_limit: 10,
    });
    expect(result.total).toBe(7);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBe("a");
  });

  it("envia p_search null quando a busca está vazia e devolve total 0 sem linhas", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const result = await fetchUnifiedPage({
      accountId: undefined,
      scope: "system",
      sinceIso: "2026-01-01T00:00:00Z",
      actionFilter: "all",
      entityFilter: "all",
      userFilter: "all",
      search: "",
      offset: 0,
      limit: 20,
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "audit_unified_page",
      expect.objectContaining({ p_account_id: null, p_search: null }),
    );
    expect(result).toEqual({ rows: [], total: 0 });
  });

  it("propaga o erro da RPC em vez de devolver dados parciais", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("falha na RPC") });

    await expect(
      fetchUnifiedPage({
        accountId: "acc-1",
        scope: "system",
        sinceIso: "2026-01-01T00:00:00Z",
        actionFilter: "all",
        entityFilter: "all",
        userFilter: "all",
        search: "",
        offset: 0,
        limit: 20,
      }),
    ).rejects.toThrow("falha na RPC");
  });
});

describe("auditoria — teto fixo e autores do conjunto completo", () => {
  beforeEach(() => rpcMock.mockReset());

  it("envia o mesmo p_to em todos os lotes quando toIso é fixado", async () => {
    const { fetchUnifiedPage } = await import("../AuditLogViewer");
    rpcMock.mockResolvedValue({ data: [], error: null });
    const toIso = "2026-10-05T01:00:00.000Z";
    for (const offset of [0, 1000, 2000]) {
      await fetchUnifiedPage({ scope: "system", sinceIso: "2026-01-01T00:00:00Z", actionFilter: "all", entityFilter: "all", userFilter: "all", search: "", offset, limit: 1000, toIso });
    }
    const tos = rpcMock.mock.calls.map((c) => (c[1] as any).p_to);
    expect(tos).toEqual([toIso, toIso, toIso]);
  });

  it("autores vêm da RPC audit_unified_authors, não da página", async () => {
    const { fetchUnifiedAuthors } = await import("../AuditLogViewer");
    rpcMock.mockResolvedValue({ data: [{ user_id: "u9", user_name: "Zeca", user_email: null }, { user_id: "u1", user_name: null, user_email: "ana@x.com" }], error: null });
    const authors = await fetchUnifiedAuthors({ scope: "system", sinceIso: "2026-01-01T00:00:00Z", actionFilter: "all", entityFilter: "all", search: "" });
    expect(rpcMock.mock.calls[0][0]).toBe("audit_unified_authors");
    expect(authors).toEqual([{ id: "u1", name: "ana@x.com" }, { id: "u9", name: "Zeca" }]);
  });
});
