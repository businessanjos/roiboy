/** Nomes que são só marcadores ("Desconhecido", "Contato", o próprio número) nunca entram em variáveis de nome. */
export function isPlaceholderContactName(name: string | null | undefined, phone?: string | null): boolean {
  const n = (name || "").trim();
  if (!n) return true;
  if (/^(desconhecido|sem nome|contato|unknown)$/i.test(n)) return true;
  const digits = n.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length >= n.replace(/[\s()+\-.]/g, "").length) return true;
  if (phone && digits && digits === phone.replace(/\D/g, "")) return true;
  return false;
}

export function realContactName(name: string | null | undefined, phone?: string | null): string {
  return isPlaceholderContactName(name, phone) ? "" : String(name).trim();
}

/** Remove o marcador de nome vazio junto com a vírgula/espaço antes: "Bom dia, {x}!" → "Bom dia!". */
export function dropEmptyNameToken(text: string, token: string): string {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`[ \\t]*,?[ \\t]*${esc}`, "gi"), "");
}
