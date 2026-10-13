/** Presentation only: never grants subscription access or changes billing. */
export function hideInternalTrialNotice(email?: string | null): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith("@anjosbusiness.com.br") ||
    normalized.endsWith("@anjosbusiness.com") ||
    ["m.quintana@me.com", "coachevertonsantos@gmail.com", "arthur.mudri@hotmail.com"].includes(normalized);
}