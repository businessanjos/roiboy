/** Presentation only: never grants subscription access or changes billing. */
/** Account of the Eternum Club team: every member (including the TV account) skips trial notices. */
export const ETERNUM_ACCOUNT_ID = "796e7970-fd93-4574-a871-6090624cace6";

export function hideInternalTrialNotice(email?: string | null, accountId?: string | null): boolean {
  if (accountId === ETERNUM_ACCOUNT_ID) return true;
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return normalized.endsWith("@anjosbusiness.com.br") ||
    normalized.endsWith("@anjosbusiness.com") ||
    ["m.quintana@me.com", "coachevertonsantos@gmail.com", "arthur.mudri@hotmail.com", "rh2@eternumoficial.com", "jessicacampos@anjosbususiness.com.br"].includes(normalized);
}