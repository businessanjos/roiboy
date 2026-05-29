/**
 * Retorna o domínio público oficial da plataforma para links compartilhados.
 * Nunca usa o domínio de preview do Lovable (id-preview--*.lovable.app).
 */
const OFFICIAL_PUBLIC_ORIGIN = "https://iamroy.app";

export function getPublicOrigin(): string {
  if (typeof window === "undefined") return OFFICIAL_PUBLIC_ORIGIN;
  const host = window.location.hostname;
  // Em desenvolvimento local, mantém o origin atual para facilitar testes
  if (host === "localhost" || host === "127.0.0.1") {
    return window.location.origin;
  }
  return OFFICIAL_PUBLIC_ORIGIN;
}

export function buildPublicContractUrl(token: string): string {
  return `${getPublicOrigin()}/contrato/${token}`;
}
