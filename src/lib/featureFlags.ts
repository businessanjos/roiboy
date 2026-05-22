const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const featureFlags = {
  marketingPersonaAiSuggest: {
    allowedEmails: ["m.quintana@me.com"],
  },
  opsConsultantWorkload: {
    allowedEmails: ["m.quintana@me.com", "jonathanmarcato@anjosbusiness.com"],
  },
} as const;

export function canUseMarketingPersonaAiSuggest(email?: string | null) {
  if (!email) return false;

  const normalizedEmail = normalizeEmail(email);
  return featureFlags.marketingPersonaAiSuggest.allowedEmails
    .map(normalizeEmail)
    .includes(normalizedEmail);
}

export function canViewOpsConsultantWorkload(email?: string | null) {
  if (!email) return false;
  const normalizedEmail = normalizeEmail(email);
  return featureFlags.opsConsultantWorkload.allowedEmails
    .map(normalizeEmail)
    .includes(normalizedEmail);
}