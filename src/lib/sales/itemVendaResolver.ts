// Resolves legacy "Item da Venda" custom-field values (which can be slugs like
// "rykas_mentoring" or "ren_rykas_mentoring") to product UUIDs, so SPIFF/quota
// filters that target a specific product_id catch every deal correctly.

const PRODUCT_SLUG_TO_ID: Record<string, string> = {
  rykas_mentoring: "8d3e9bb6-054b-44b3-952f-5920e0ed8775",
  ren_rykas_mentoring: "8d3e9bb6-054b-44b3-952f-5920e0ed8775",
  rykas: "8d3e9bb6-054b-44b3-952f-5920e0ed8775",
  rykas_pass: "8d3e9bb6-054b-44b3-952f-5920e0ed8775",
  eternum_club: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7",
  ren_eternum_club: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7",
  eternum_mvp: "8e8b0cc7-6965-4241-9aab-b959e7fc7893",
  eternum_private: "8e8b0cc7-6965-4241-9aab-b959e7fc7893",
  conselho: "abf8cd6f-3399-4af4-92c6-50fc1a966243",
  conselho_de_anjo: "abf8cd6f-3399-4af4-92c6-50fc1a966243",
  conselho_anjo: "abf8cd6f-3399-4af4-92c6-50fc1a966243",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveItemVendaToProductId(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (UUID_RE.test(trimmed)) return trimmed;
  return PRODUCT_SLUG_TO_ID[trimmed.toLowerCase()] ?? "";
}
