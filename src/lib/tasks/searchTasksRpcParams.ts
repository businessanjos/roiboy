/**
 * Monta os parâmetros da RPC `search_tasks_page` usada em src/pages/Tasks.tsx
 * quando há um termo de busca ativo. Mantido separado da página para poder
 * ser testado isoladamente (mapeamento puro, sem rede).
 *
 * Reproduz exatamente os filtros já aplicados hoje no servidor (sector +
 * filtro de usuário) e troca a busca por IDs de clients/leads/deals (que
 * hoje chegava a concatenar até 50000 IDs num .or(...in...)) pelo predicado
 * EXISTS feito dentro da função no banco.
 */
export type FilterUserValue = string; // "all" | "mine" | <user id>

export interface BuildSearchTasksParamsInput {
  accountId: string;
  search: string;
  sectorActivityTypeIds: string[] | null;
  isHistoricalUserFilter: boolean;
  filterUser: FilterUserValue;
  currentUserId: string | null | undefined;
  limit: number;
  offset: number;
  sortBy?: "created_at" | "due_date" | "priority";
  sortDirection?: "asc" | "desc";
}

export interface SearchTasksRpcParams {
  p_account_id: string;
  p_search: string;
  p_sector_activity_type_ids: string[] | null;
  p_apply_sector_filter: boolean;
  p_filter_mode: "all" | "mine" | "user";
  p_filter_user_id: string | null;
  p_current_user_id: string | null;
  p_custom_status_id: null;
  p_stage_id: null;
  p_deal_id: null;
  p_lead_id: null;
  p_date_start: null;
  p_date_end: null;
  p_sort_by: "created_at" | "due_date" | "priority";
  p_sort_direction: "asc" | "desc";
  p_limit: number;
  p_offset: number;
}

export function buildSearchTasksRpcParams(
  input: BuildSearchTasksParamsInput
): SearchTasksRpcParams {
  const {
    accountId,
    search,
    sectorActivityTypeIds,
    isHistoricalUserFilter,
    filterUser,
    currentUserId,
    limit,
    offset,
    sortBy = "created_at",
    sortDirection = "desc",
  } = input;

  const applySectorFilter =
    !isHistoricalUserFilter &&
    !!sectorActivityTypeIds &&
    sectorActivityTypeIds.length > 0;

  let filterMode: "all" | "mine" | "user" = "all";
  let filterUserId: string | null = null;
  let currentUserIdForRpc: string | null = null;

  if (filterUser === "mine" && currentUserId) {
    filterMode = "mine";
    currentUserIdForRpc = currentUserId;
  } else if (filterUser !== "all" && filterUser !== "mine" && filterUser) {
    filterMode = "user";
    filterUserId = filterUser;
  }

  return {
    p_account_id: accountId,
    p_search: search,
    p_sector_activity_type_ids: applySectorFilter ? sectorActivityTypeIds : null,
    p_apply_sector_filter: applySectorFilter,
    p_filter_mode: filterMode,
    p_filter_user_id: filterUserId,
    p_current_user_id: currentUserIdForRpc,
    p_custom_status_id: null,
    p_stage_id: null,
    p_deal_id: null,
    p_lead_id: null,
    p_date_start: null,
    p_date_end: null,
    p_sort_by: sortBy,
    p_sort_direction: sortDirection,
    p_limit: limit,
    p_offset: offset,
  };
}
