export const CONTACT_CHANNELS = [
  { value: "3c_plus", label: "3C Plus" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Chamada telefônica" },
] as const;

export type ContactChannel = (typeof CONTACT_CHANNELS)[number]["value"];

export function getContactChannelLabel(value?: string | null): string {
  if (!value) return "";
  const known = CONTACT_CHANNELS.find((c) => c.value === value)?.label;
  if (known) return known;
  // Ferramentas personalizadas ficam salvas como slug; exibe de forma legível
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Atividades de ligação (atendida / não atendida) exigem sinalizar
 * a ferramenta usada, para conseguirmos mapear o canal mais eficiente.
 */
export function activityRequiresContactChannel(activityName?: string | null): boolean {
  if (!activityName) return false;
  const n = activityName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return n.includes("ligacao");
}
