/** Imagens nas TVs: a TV abre a página estática tv-imagem.html com o link público da imagem. */
export const TV_SITE = "https://iamroy.app";
const FN = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "mtzoavtbtqflufyccern"}.supabase.co/functions/v1/tv-media-public`;
export type TvImageFit = "contain" | "cover";

export function tvMediaSrc(path: string): string {
  return `${FN}?p=${encodeURIComponent(path)}`;
}

export function buildTvImageUrl(src: string, fit: TvImageFit): string {
  return `${TV_SITE}/tv-imagem.html?src=${encodeURIComponent(src)}&fit=${fit}`;
}

export function isTvImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try { return new URL(url).pathname.endsWith("/tv-imagem.html"); } catch { return false; }
}

export function parseTvImageUrl(url: string | null | undefined): { src: string; fit: TvImageFit } | null {
  if (!isTvImageUrl(url)) return null;
  const u = new URL(url!);
  return { src: u.searchParams.get("src") ?? "", fit: u.searchParams.get("fit") === "cover" ? "cover" : "contain" };
}

/** Campos a salvar na tela ao aplicar um conteúdo. Imagem com "Mostrar até" guarda o conteúdo anterior para voltar. */
export function screenPatchFor(current: { url: string | null; previous_url?: string | null }, nextUrl: string, until: string | null) {
  if (!isTvImageUrl(nextUrl) || !until) return { url: nextUrl, previous_url: null, image_until: null };
  const prev = isTvImageUrl(current.url) ? current.previous_url ?? null : current.url;
  return { url: nextUrl, previous_url: prev, image_until: until };
}
