/**
 * Parâmetros das RPCs `search_tasks_page2` (página/ordem/total) e
 * `search_tasks_counts` (contagens por aba e indicadores) usadas em
 * src/pages/Tasks.tsx quando há busca ativa. Ambas aplicam no servidor o
 * MESMO predicado (`tasks_filtered`): busca em 8 campos, setor efetivo,
 * usuário, tipo de atividade, etapa, negociação e prazo — tudo antes de
 * contar, ordenar e paginar. Mapeamento puro, sem rede.
 */
export type FilterUserValue = string; // "all" | "mine" | <user id>
export type TaskSortBy = "priority" | "due_date" | "created_at" | "responsible" | "stage";

export interface TaskStatusLite {
  id: string;
  name: string;
  is_default?: boolean | null;
  is_completed_status?: boolean | null;
}

export interface TaskFilterInput {
  accountId: string;
  search: string;
  sectorId: string | null | undefined;
  sectorActivityTypeIds: string[] | null;
  isHistoricalUserFilter: boolean;
  filterUser: FilterUserValue;
  currentUserId: string | null | undefined;
  activityType: string; // "all" | id
  stage: string; // "all" | id
  negotiation: string; // "all" | "deal:<id>" | "lead:<id>"
  dateStart: string; // "" | yyyy-MM-dd
  dateEnd: string;
  /** Dia LOCAL de quem vê (yyyy-MM-dd) — base de "Atrasadas". */
  today: string;
  statuses: TaskStatusLite[];
}

export interface BuildSearchTasksParamsInput extends TaskFilterInput {
  tab: string | null; // null | status id | "__overdue__"
  sortBy: TaskSortBy;
  sortDirection: "asc" | "desc";
  limit: number;
  offset: number;
}

function baseParams(i: TaskFilterInput) {
  const applySector =
    !i.isHistoricalUserFilter && !!i.sectorActivityTypeIds && i.sectorActivityTypeIds.length > 0;
  let mode: "all" | "mine" | "user" = "all";
  let filterUserId: string | null = null;
  let currentUserId: string | null = null;
  if (i.filterUser === "mine" && i.currentUserId) {
    mode = "mine";
    currentUserId = i.currentUserId;
  } else if (i.filterUser && i.filterUser !== "all" && i.filterUser !== "mine") {
    mode = "user";
    filterUserId = i.filterUser;
  }
  return {
    p_account_id: i.accountId,
    p_search: i.search.trim(),
    p_sector_id: i.sectorId || null,
    p_historical: i.isHistoricalUserFilter,
    p_sector_activity_type_ids: applySector ? i.sectorActivityTypeIds : null,
    p_filter_mode: mode,
    p_filter_user_id: filterUserId,
    p_current_user_id: currentUserId,
    p_activity_type_id: i.activityType !== "all" ? i.activityType : null,
    p_stage_id: i.stage !== "all" ? i.stage : null,
    p_negotiation: i.negotiation !== "all" ? i.negotiation : null,
    p_date_start: i.dateStart || null,
    p_date_end: i.dateEnd || null,
    p_today: i.today,
    p_default_status_id: i.statuses.find((s) => s.is_default)?.id ?? null,
    p_completed_status_ids: i.statuses.filter((s) => s.is_completed_status).map((s) => s.id),
  };
}

export function buildSearchTasksRpcParams(i: BuildSearchTasksParamsInput) {
  return {
    ...baseParams(i),
    p_tab: i.tab || null,
    p_sort_by: i.sortBy,
    p_sort_direction: i.sortDirection,
    p_limit: i.limit,
    p_offset: i.offset,
  };
}
export type SearchTasksRpcParams = ReturnType<typeof buildSearchTasksRpcParams>;

export function buildSearchTasksCountsParams(i: TaskFilterInput) {
  const pending = i.statuses.find((s) => s.name.toLowerCase().includes("pendente"));
  const inProgress = i.statuses.find((s) => s.name.toLowerCase().includes("andamento"));
  return {
    ...baseParams(i),
    p_status_ids: i.statuses.map((s) => s.id),
    p_pending_status_id: pending?.id ?? null,
    p_pending_is_default: !!pending?.is_default,
    p_in_progress_status_id: inProgress?.id ?? null,
  };
}

type RpcFn = (
  fn: string,
  params: Record<string, unknown>
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Uma página: ids na ordem do servidor + total do mesmo predicado. */
export async function fetchSearchTasksPage(rpc: RpcFn, params: SearchTasksRpcParams) {
  const { data, error } = await rpc("search_tasks_page2", params);
  if (error) throw error;
  const rows = (data || []) as { id: string; total_count: number | string }[];
  return { ids: rows.map((r) => r.id), total: rows.length ? Number(rows[0].total_count) || 0 : 0 };
}

/**
 * Até `maxRows` correspondências (Kanban "Carregar mais"), em páginas reais
 * com offset — nunca um único p_limit grande, que o teto do servidor (ex.:
 * 1000 linhas) cortaria. Avança pelo número de linhas recebidas, deduplica e
 * para ao atingir o total do mesmo predicado ou uma página vazia.
 */
export async function fetchSearchTasksUpTo(
  rpc: RpcFn,
  params: SearchTasksRpcParams,
  maxRows: number,
  batchSize = 500
): Promise<{ ids: string[]; total: number }> {
  const ids: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  let offset = 0;
  while (ids.length < maxRows) {
    const want = Math.min(batchSize, maxRows - ids.length);
    const page = await fetchSearchTasksPage(rpc, { ...params, p_limit: want, p_offset: offset });
    total = page.total;
    if (page.ids.length === 0) break;
    offset += page.ids.length;
    for (const id of page.ids) if (!seen.has(id)) { seen.add(id); ids.push(id); }
    if (offset >= page.total) break;
  }
  return { ids, total };
}

/**
 * Todas as correspondências (exportação), em lotes com o MESMO predicado e
 * ordem, até esgotar — sem teto. Qualquer erro aborta tudo.
 */
export async function fetchAllSearchTaskIds(
  rpc: RpcFn,
  params: SearchTasksRpcParams,
  batchSize = 500
): Promise<string[]> {
  return (await fetchSearchTasksUpTo(rpc, params, Number.POSITIVE_INFINITY, batchSize)).ids;
}

/**
 * Exportação: gate ANTES de qualquer consulta. Sem permissão → null, nenhuma
 * chamada. Com permissão → todas as correspondências (com ou sem busca).
 */
export async function exportTaskIds(
  canExport: boolean,
  rpc: RpcFn,
  params: SearchTasksRpcParams,
  batchSize = 500
): Promise<string[] | null> {
  if (!canExport) return null;
  return fetchAllSearchTaskIds(rpc, params, batchSize);
}

export async function fetchSearchTasksCounts(rpc: RpcFn, params: ReturnType<typeof buildSearchTasksCountsParams>) {
  const { data, error } = await rpc("search_tasks_counts", params);
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const r of (data || []) as { key: string; n: number | string }[]) map[r.key] = Number(r.n) || 0;
  return map;
}
