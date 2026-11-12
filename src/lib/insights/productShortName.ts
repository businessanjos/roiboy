/** Sigla curta do produto para exibição compacta (ex.: "EM", "CR", "EC"). */
export function productShortName(name: string): string {
  const raw = (name || "").trim();
  if (!raw) return "?";
  const prefix = raw.split(/\s*[|–-]\s*/)[0]?.trim() ?? "";
  if (/^[A-Z0-9]{1,4}$/.test(prefix)) return prefix;
  const n = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("clinica ryka") || /\bcr\b/.test(n)) return "CR";
  if (n.includes("eternum club") || n.includes("mentoring club")) return "EC";
  if (n.includes("mentoring")) return "EM";
  const words = raw.split(/\s+/).filter((w) => w.length > 2);
  return (words.slice(0, 3).map((w) => w[0]).join("") || raw.slice(0, 3)).toUpperCase();
}
