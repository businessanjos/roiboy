import { supabase } from "@/integrations/supabase/client";
import { resolveItemVendaToProductId } from "@/lib/sales/itemVendaResolver";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const looksCoded = (v: string) => UUID_RE.test(v.trim()) || /^[a-z0-9]+(_[a-z0-9]+)+$/.test(v.trim());

/**
 * Resolves "coded" custom-field values (product UUIDs or legacy slugs like
 * "ren_rykas_mentoring") into human product names.
 * Returns a map rawValue -> friendly label (only for values it could resolve).
 */
export async function resolveProductLabels(rawValues: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const coded = Array.from(new Set(rawValues.filter((v) => v && looksCoded(v))));
  if (coded.length === 0) return map;

  const rawToProductId = new Map<string, string>();
  for (const raw of coded) {
    const id = UUID_RE.test(raw.trim()) ? raw.trim() : resolveItemVendaToProductId(raw);
    if (id) rawToProductId.set(raw, id);
  }

  const ids = Array.from(new Set(rawToProductId.values()));
  if (ids.length === 0) return map;

  const { data, error } = await supabase.from("products").select("id, name").in("id", ids);
  if (error) {
    console.error("Error resolving product labels:", error);
    return map;
  }

  const idToName = new Map<string, string>();
  for (const p of data || []) idToName.set(p.id, p.name);

  for (const [raw, id] of rawToProductId) {
    const name = idToName.get(id);
    if (name) map.set(raw, name);
  }
  return map;
}

/** Formats a possibly multi-value label list using the resolved product names. */
export function applyProductLabels(values: string[], map: Map<string, string>): string {
  return values.map((v) => map.get(v) || v).join(", ");
}

export { looksCoded };
