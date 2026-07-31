import { supabase } from "@/integrations/supabase/client";
import { resolveItemVendaToProductId } from "@/lib/sales/itemVendaResolver";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Legacy "Item da Venda" slugs -> product id, for LABEL purposes.
 * The commission resolver intentionally collapses renewals into the base
 * product; for charts each renewal must keep its own product name.
 */
const LABEL_SLUG_TO_PRODUCT_ID: Record<string, string> = {
  rykas_mentoring: "8d3e9bb6-054b-44b3-952f-5920e0ed8775", // RM l Rykas Mentoring
  ren_rykas_mentoring: "eae406e9-6076-41eb-96ed-df0ab187a11c", // REN. RM l Rykas Mentoring
  eternum_club: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7", // EC l Eternum Club
  ren_eternum_club: "6f74bb43-a1be-410f-a708-6abab066bb38", // REN. EC l Eternum Club
  eternum_private: "ab609e84-9c61-4e0b-9559-212010d9be83", // EP l Eternum Private
  ren_eternum_private: "b7ba9aa5-42fd-4419-b813-5de646d6711c", // REN. EP l Eternum Private
  eternum_mvp: "8e8b0cc7-6965-4241-9aab-b959e7fc7893", // Eternum MVP
  conselho_anjo: "abf8cd6f-3399-4af4-92c6-50fc1a966243", // Conselho de Anjo
  rykas_pass: "51f88404-c59f-41bf-a3f5-b71ad209b94d", // E-Pass l Eternum Pass
};

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
