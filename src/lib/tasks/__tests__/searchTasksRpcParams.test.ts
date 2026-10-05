import { describe, it, expect } from "vitest";
import { buildSearchTasksRpcParams } from "../searchTasksRpcParams";

describe("buildSearchTasksRpcParams", () => {
  const base = {
    accountId: "acc-1",
    search: "joão",
    sectorActivityTypeIds: ["at-1", "at-2"],
    isHistoricalUserFilter: false,
    filterUser: "all" as const,
    currentUserId: "user-1",
    limit: 1000,
    offset: 0,
  };

  it("aplica filtro de setor quando não é filtro histórico de usuário e há tipos de atividade", () => {
    const params = buildSearchTasksRpcParams(base);
    expect(params.p_apply_sector_filter).toBe(true);
    expect(params.p_sector_activity_type_ids).toEqual(["at-1", "at-2"]);
    expect(params.p_filter_mode).toBe("all");
    expect(params.p_filter_user_id).toBeNull();
    expect(params.p_current_user_id).toBeNull();
  });

  it("não aplica filtro de setor quando é filtro histórico de usuário (auditoria nominal)", () => {
    const params = buildSearchTasksRpcParams({ ...base, isHistoricalUserFilter: true, filterUser: "user-2" });
    expect(params.p_apply_sector_filter).toBe(false);
    expect(params.p_sector_activity_type_ids).toBeNull();
    expect(params.p_filter_mode).toBe("user");
    expect(params.p_filter_user_id).toBe("user-2");
  });

  it("não aplica filtro de setor quando sectorActivityTypeIds é vazio ou nulo", () => {
    expect(buildSearchTasksRpcParams({ ...base, sectorActivityTypeIds: [] }).p_apply_sector_filter).toBe(false);
    expect(buildSearchTasksRpcParams({ ...base, sectorActivityTypeIds: null }).p_apply_sector_filter).toBe(false);
  });

  it("mapeia filterUser = 'mine' para p_filter_mode 'mine' com o usuário atual", () => {
    const params = buildSearchTasksRpcParams({ ...base, filterUser: "mine", currentUserId: "me-1" });
    expect(params.p_filter_mode).toBe("mine");
    expect(params.p_current_user_id).toBe("me-1");
    expect(params.p_filter_user_id).toBeNull();
  });

  it("mapeia filterUser = 'mine' sem currentUserId para modo 'all' (sem id para filtrar)", () => {
    const params = buildSearchTasksRpcParams({ ...base, filterUser: "mine", currentUserId: null });
    expect(params.p_filter_mode).toBe("all");
    expect(params.p_current_user_id).toBeNull();
  });

  it("mapeia um usuário específico para p_filter_mode 'user'", () => {
    const params = buildSearchTasksRpcParams({ ...base, filterUser: "user-99" });
    expect(params.p_filter_mode).toBe("user");
    expect(params.p_filter_user_id).toBe("user-99");
  });

  it("repassa busca, paginação e conta corretamente", () => {
    const params = buildSearchTasksRpcParams({ ...base, search: "maria", limit: 500, offset: 1000 });
    expect(params.p_search).toBe("maria");
    expect(params.p_limit).toBe(500);
    expect(params.p_offset).toBe(1000);
    expect(params.p_account_id).toBe("acc-1");
  });

  it("usa valores padrão de ordenação quando não informados", () => {
    const params = buildSearchTasksRpcParams(base);
    expect(params.p_sort_by).toBe("created_at");
    expect(params.p_sort_direction).toBe("desc");
  });
});
