/** Explicit contact identity takes precedence over stale WhatsApp participant names. */
export function zappMentionName(name: string, phone = ""): string {
  const number = phone.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (number === "5551995471095" || number === "51995471095" || name.trim().toLowerCase() === "bruno suporte") {
    return "Bruno Suporte";
  }
  // Remove rótulos como "Interno:" / "Equipe -" antes do nome real
  const clean = name.trim().replace(/^(interno|interna|equipe|time|staff|desconhecido)\s*[:\-–]?\s*/i, "");
  const first = clean.split(/\s+/)[0] || "";
  return /^(interno|interna|equipe|time|staff|desconhecido):?$/i.test(first) ? "" : first;
}