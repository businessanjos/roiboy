// Extrai a melhor URL de thumbnail de um item de mídia retornado pela HikerAPI,
// cobrindo: post simples, reels/vídeos, carrossel (carousel_media) e variantes
// antigas (resources / image_versions.items / thumbnail_src / display_uri).
export function pickThumb(m: any): string | null {
  if (!m || typeof m !== "object") return null;

  // 1) Campos diretos
  const direct =
    m.thumbnail_url ||
    m.thumbnail_src ||
    m.display_url ||
    m.display_uri ||
    null;
  if (direct) return direct;

  // 2) image_versions2.candidates[0].url (formato comum HikerAPI v2)
  const iv2 = m.image_versions2?.candidates?.[0]?.url;
  if (iv2) return iv2;

  // 3) image_versions.items[0].url (formato antigo)
  const ivItems = m.image_versions?.items?.[0]?.url;
  if (ivItems) return ivItems;

  // 4) Carrossel: media_type 8 → primeiro filho com imagem
  const child = m.carousel_media?.[0] || m.resources?.[0];
  if (child) {
    const c =
      child.thumbnail_url ||
      child.thumbnail_src ||
      child.display_url ||
      child.image_versions2?.candidates?.[0]?.url ||
      child.image_versions?.items?.[0]?.url ||
      null;
    if (c) return c;
  }

  return null;
}
