/** Shared by manual messages and sequence snapshots; never signs twice. */
export function applyZappSignature(text: string, signature: string, enabled: boolean): string {
  const baseText = text.trim();
  const cleanSignature = signature.trim().replace(/:+$/, "").trim();
  const firstLine = baseText.split(/\r?\n/, 1)[0]?.trim();
  if (!enabled || !cleanSignature || !baseText || firstLine === `*${cleanSignature}:*` || firstLine === `*${cleanSignature}*`) {
    return baseText;
  }
  return `*${cleanSignature}:*\n${baseText}`;
}