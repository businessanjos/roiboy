import type { CustomField } from "@/components/custom-fields/CustomFieldsManager";

export type BulkDealAction =
  | { type: "move"; pipelineId: string; stageId: string }
  | { type: "product"; productId: string }
  | { type: "value"; value: number }
  | { type: "field"; field: CustomField; value: unknown };

export interface BulkDealResult {
  id: string;
  title: string;
  success: boolean;
  changed?: boolean;
  error?: string;
}

/** Only the requested change is sent; identity and snapshots are always server-derived. */
export function serializeBulkAction(action: BulkDealAction) {
  if (action.type !== "field") return { ...action };
  return { type: action.type, fieldId: action.field.id, fieldType: action.field.field_type, columns: bulkFieldColumns(action.field, action.value) };
}

export function selectedFilteredDeals<T extends { id: string }>(deals: T[], selected: ReadonlySet<string>): T[] {
  return deals.filter(deal => selected.has(deal.id));
}

/** Stage selection includes every filtered card, not just the first rendered page. */
export function toggleBulkStageSelection<T extends { id: string; stage_id: string | null }>(deals: T[], selected: ReadonlySet<string>, stageId: string): Set<string> {
  const stageDeals = deals.filter(deal => deal.stage_id === stageId);
  const allSelected = stageDeals.length > 0 && stageDeals.every(deal => selected.has(deal.id));
  const next = new Set(selected);
  for (const deal of stageDeals) {
    if (allSelected) next.delete(deal.id); else next.add(deal.id);
  }
  return next;
}

export function bulkDestinationPipelines<T extends { name: string }>(pipelines: T[]): T[] {
  return pipelines.filter(pipeline => !pipeline.name.toLowerCase().includes("repescagem"));
}

export function parseBulkNumber(value: string): number | null {
  const text = value.trim().replace(/\s|R\$/g, "");
  if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(text)) return null;
  const number = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function bulkFieldColumns(field: CustomField, value: unknown) {
  const columns = {
    value_text: null as string | null,
    value_number: null as number | null,
    value_boolean: null as boolean | null,
    value_date: null as string | null,
    value_json: null as unknown,
  };
  switch (field.field_type) {
    case "number": case "currency":
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new Error("Informe um número válido.");
      columns.value_number = value as number | null; break;
    case "boolean":
      if (value !== null && typeof value !== "boolean") throw new Error("Escolha Sim ou Não.");
      columns.value_boolean = value as boolean | null; break;
    case "date": columns.value_date = value as string | null; break;
    case "multi_select": case "user": case "location": case "multi_instagram":
      columns.value_json = value; break;
    default: columns.value_text = value as string | null;
  }
  return columns;
}

/** Same qualification rule used by the individual deal editor. */
export function mqlFromRevenue(value: unknown, options: CustomField["options"]): string | null {
  if (!value) return null;
  const label = options.find(option => option.value === value)?.label || String(value);
  const normalized = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const abaixo = normalized.match(/abaixo\s+de\s+(\d+)/);
  const entre = normalized.match(/entre\s+(\d+)\s+e\s+(\d+)/);
  return (abaixo && Number(abaixo[1]) <= 30) || (entre && Number(entre[2]) <= 30)
    ? "nao_abaixo_30k" : "sim_acima_30k";
}

/** Each outcome is independent; failed records are never automatically retried. */
export async function runBulkDeals(
  deals: { id: string; title: string }[],
  execute: (id: string) => Promise<void>,
  onProgress: (result: BulkDealResult, completed: number) => void,
  isCancelled: () => boolean = () => false,
): Promise<BulkDealResult[]> {
  const results: BulkDealResult[] = [];
  for (const deal of deals) {
    if (isCancelled()) break;
    let result: BulkDealResult;
    try {
      await execute(deal.id);
      result = { ...deal, success: true };
    } catch (error) {
      result = { ...deal, success: false, error: error instanceof Error ? error.message : "Não foi possível alterar este negócio." };
    }
    results.push(result);
    onProgress(result, results.length);
  }
  return results;
}