/** Optional fields offered when a deal is created; all of them stay editable on the deal afterwards. */
export type CreateDealFieldKey = "canal" | "origem" | "faturamento" | "mql";

export interface CreateDealFieldDef {
  id: string;
  name: string;
  field_type: string;
  display_order?: number | null;
  options?: { label: string; value: string; color?: string }[] | null;
}

export interface CreateDealField extends CreateDealFieldDef {
  key: CreateDealFieldKey;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const MATCHERS: { key: CreateDealFieldKey; match: (n: string) => boolean }[] = [
  { key: "canal", match: (n) => n === "canal de venda" || n === "canal de vendas" || n === "canal" },
  { key: "origem", match: (n) => n === "origem da venda" || n === "origem de venda" || n === "origem" },
  { key: "faturamento", match: (n) => n === "faturamento atual" || n === "faturamento" },
  { key: "mql", match: (n) => n === "mql" },
];

/** Finds the account's own deal fields by name, in a fixed order; missing ones are simply left out. */
export function pickCreateDealFields(fields: readonly CreateDealFieldDef[]): CreateDealField[] {
  const sorted = [...fields].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const out: CreateDealField[] = [];
  for (const { key, match } of MATCHERS) {
    const found = sorted.find((f) => match(norm(f.name)));
    if (found) out.push({ ...found, key });
  }
  return out;
}

export function isEmptyFieldValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Rows for deal_field_values; blank answers produce no row, so nothing is written for skipped fields. */
export function buildDealExtraRows(
  accountId: string,
  dealId: string,
  fields: readonly CreateDealFieldDef[],
  values: Record<string, unknown>,
) {
  return fields
    .filter((f) => !isEmptyFieldValue(values[f.id]))
    .map((f) => {
      const v = values[f.id];
      const json = f.field_type === "multi_select";
      return {
        account_id: accountId,
        deal_id: dealId,
        field_id: f.id,
        value_text: json ? null : String(v),
        value_json: json ? (Array.isArray(v) ? v : [v]) : null,
      };
    });
}
