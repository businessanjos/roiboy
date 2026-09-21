// Resolves legacy "Item da Venda" custom-field values (which can be slugs like
// "rykas_mentoring" or "ren_rykas_mentoring") to product UUIDs, so SPIFF/quota
// filters that target a specific product_id catch every deal correctly.
//
// IMPORTANTE: renovações (REN. ...) são produtos distintos e NUNCA devem ser
// resolvidas para o produto de venda nova — senão campanhas como o Hat Trick
// (exclusivo EM) acabam contando renovações.

export const PRODUCT_IDS = {
  EM: "f48e141b-e3da-4547-9b4a-70548fcdfe2c", // EM l Eternum Mentoring
  EML: "311124ee-a8ee-4695-b26d-972742eb751b", // EML l Eternum Mentoring Low
  EC: "b8c50eca-6fd9-41ac-a1d3-f78086daaea7", // EC l Eternum Club
  EP: "ab609e84-9c61-4e0b-9559-212010d9be83", // EP l Eternum Private
  RM: "8d3e9bb6-054b-44b3-952f-5920e0ed8775", // RM l Rykas Mentoring
  MVP: "8e8b0cc7-6965-4241-9aab-b959e7fc7893", // Eternum MVP
  DAILY_MVP: "9893ec8f-db35-46b4-be9e-6ed2d96f4450",
  CA: "abf8cd6f-3399-4af4-92c6-50fc1a966243", // Conselho de Anjo
  EPASS: "51f88404-c59f-41bf-a3f5-b71ad209b94d", // E-Pass
  CLINICA_RYKA: "feb34040-ba60-417a-a5d3-66dbdf1cfc02",
  CONSULTORIA: "2a8a4b0e-59f1-46f0-bb60-5b60fb092f81",
  REN_EM: "27d83762-7ce0-49d5-a12b-b51571303096",
  REN_EC: "6f74bb43-a1be-410f-a708-6abab066bb38",
  REN_EP: "b7ba9aa5-42fd-4419-b813-5de646d6711c",
  REN_RM: "eae406e9-6076-41eb-96ed-df0ab187a11c",
} as const;

/** Produtos de renovação — não contam como venda nova em campanhas. */
export const RENEWAL_PRODUCT_IDS = new Set<string>([
  PRODUCT_IDS.REN_EM,
  PRODUCT_IDS.REN_EC,
  PRODUCT_IDS.REN_EP,
  PRODUCT_IDS.REN_RM,
]);

export const isRenewalProductId = (id: string | null | undefined) => !!id && RENEWAL_PRODUCT_IDS.has(id);

const PRODUCT_SLUG_TO_ID: Record<string, string> = {
  eternum_mentoring: PRODUCT_IDS.EM,
  em: PRODUCT_IDS.EM,
  eternum_mentoring_low: PRODUCT_IDS.EML,
  eml: PRODUCT_IDS.EML,
  // Rebranding RM -> EM: a opção "rykas_mentoring" do campo Item da Venda
  // hoje tem o rótulo "EM l Eternum Mentoring" (ver custom_fields.options),
  // então precisa resolver para o produto EM, não para o RM legado.
  rykas_mentoring: PRODUCT_IDS.EM,
  rykas: PRODUCT_IDS.EM,
  rm: PRODUCT_IDS.RM,
  eternum_club: PRODUCT_IDS.EC,
  ec: PRODUCT_IDS.EC,
  eternum_private: PRODUCT_IDS.EP,
  ep: PRODUCT_IDS.EP,
  eternum_mvp: PRODUCT_IDS.MVP,
  mvp: PRODUCT_IDS.MVP,
  daily_mvp: PRODUCT_IDS.DAILY_MVP,
  conselho: PRODUCT_IDS.CA,
  conselho_de_anjo: PRODUCT_IDS.CA,
  conselho_anjo: PRODUCT_IDS.CA,
  ca: PRODUCT_IDS.CA,
  rykas_pass: PRODUCT_IDS.EPASS,
  eternum_pass: PRODUCT_IDS.EPASS,
  e_pass: PRODUCT_IDS.EPASS,
  clinica_ryka: PRODUCT_IDS.CLINICA_RYKA,
  consultoria_premium: PRODUCT_IDS.CONSULTORIA,
  // Renovações — produtos próprios
  ren_eternum_mentoring: PRODUCT_IDS.REN_EM,
  ren_eternum_club: PRODUCT_IDS.REN_EC,
  ren_eternum_private: PRODUCT_IDS.REN_EP,
  // "ren_rykas_mentoring" hoje é rotulada "REN. EM l Eternum Mentoring"
  ren_rykas_mentoring: PRODUCT_IDS.REN_EM,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveItemVendaToProductId(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (UUID_RE.test(trimmed)) return trimmed;
  return PRODUCT_SLUG_TO_ID[trimmed.toLowerCase()] ?? "";
}

/**
 * Regra oficial de "esta venda conta para a campanha?".
 * Renovação nunca conta, mesmo quando a campanha é do produto base.
 */
export function dealCountsForTargetProduct(
  rawValue: string | null | undefined,
  targetProductId: string | null | undefined,
): boolean {
  const resolved = resolveItemVendaToProductId(rawValue);
  if (!targetProductId) return !isRenewalProductId(resolved);
  if (isRenewalProductId(targetProductId)) return resolved === targetProductId;
  return resolved === targetProductId && !isRenewalProductId(resolved);
}
