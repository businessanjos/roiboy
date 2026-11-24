import { resolveItemVendaToProductId } from "./itemVendaResolver";

export const PIPELINE_ITEM_VENDA_FIELD_ID = "033b91fb-3add-4c96-aec9-567fefbd0fb2";
export interface PipelineFilterValueContext {
  itemOptions?: ReadonlyArray<{ value: string; label: string }> | null;
  products?: ReadonlyArray<{ id: string; name: string }>;
}
export interface PipelineFieldValueRow {
  deal_id: string | null;
  field_id: string;
  value_text?: string | null;
  value_number?: number | null;
  value_date?: string | null;
  value_boolean?: boolean | null;
  value_json?: unknown;
}

export function getPipelineCustomFieldIds(conditions: ReadonlyArray<{ field: string }> = []): string[] {
  return [...new Set(conditions.filter(condition => condition.field.startsWith("custom:")).map(condition => condition.field.slice(7)).filter(Boolean))].sort();
}

// Presentation-only identity: the saved option and the product UUID refer to the same item.
// Never fuzzy-match product names or collapse renewal SKUs into new sales.
export function matchesPipelineItemVenda(raw: unknown, selected: unknown, context: PipelineFilterValueContext = {}): boolean {
  const a = String(raw ?? "").trim().toLowerCase();
  const b = String(selected ?? "").trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const resolve = (value: string) => {
    const known = resolveItemVendaToProductId(value);
    if (known) return known;
    const option = context.itemOptions?.find(item => item.value.trim().toLowerCase() === value);
    const label = (option?.label ?? value).trim().toLowerCase();
    return context.products?.find(product => product.name.trim().toLowerCase() === label)?.id.toLowerCase() ?? "";
  };
  const productA = resolve(a);
  const productB = resolve(b);
  return Boolean(productA && productB && productA === productB);
}

export function indexPipelineFieldValues(rows: PipelineFieldValueRow[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    if (!row.deal_id || !row.field_id) continue;
    let value = "";
    if (row.value_text != null && row.value_text !== "") value = String(row.value_text);
    else if (row.value_number != null) value = String(row.value_number);
    else if (row.value_date != null) value = String(row.value_date);
    else if (row.value_boolean != null) value = row.value_boolean ? "true" : "false";
    else if (Array.isArray(row.value_json)) value = row.value_json.length ? `|${row.value_json.map(String).join("|")}|` : "";
    else if (row.value_json != null) value = typeof row.value_json === "string" ? row.value_json : JSON.stringify(row.value_json);
    (result[row.deal_id] ??= {})[row.field_id] = value;
  }
  return result;
}