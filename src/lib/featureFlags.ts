const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const featureFlags = {
  marketingPersonaAiSuggest: {
    allowedEmails: ["m.quintana@me.com"],
  },
} as const;

export function canUseMarketingPersonaAiSuggest(email?: string | null) {
  if (!email) return false;

  const normalizedEmail = normalizeEmail(email);
  return featureFlags.marketingPersonaAiSuggest.allowedEmails
    .map(normalizeEmail)
    .includes(normalizedEmail);
}