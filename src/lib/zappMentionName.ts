/** Explicit contact identity takes precedence over stale WhatsApp participant names. */
export function zappMentionName(name: string, phone = ""): string {
  const number = phone.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (number === "5551995471095" || number === "51995471095" || name.trim().toLowerCase() === "bruno suporte") {
    return "Bruno Suporte";
  }
  return name.trim().split(/\s+/)[0] || "";
}