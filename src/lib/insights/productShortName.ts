/** Produto de renovação: nome começa com "REN." / "REN " / "Renovação". */
export function isRenewalProduct(name: string): boolean {
  const n = (name || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /^ren(\.|\s|ovacao)/.test(n);
}

function baseShortName(raw: string): string {
  // Prefixo antes do separador: "EM l Eternum Mentoring", "EM | ...", "EM - ...".
  const prefix = raw.split(/\s+[|lI\u2013-]\s+/)[0]?.trim() ?? "";
  if (/^[A-Z0-9-]{1,5}$/.test(prefix)) return prefix;
  const n = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("clinica ryka") || /\bcr\b/.test(n)) return "CR";
  if (n.includes("rykas mentoring")) return "RM";
  if (n.includes("eternum club") || n.includes("mentoring club")) return "EC";
  if (n.includes("eternum private")) return "EP";
  if (n.includes("mentoring")) return "EM";
  const words = raw.split(/\s+/).filter((w) => w.length > 2);
  return (words.slice(0, 3).map((w) => w[0]).join("") || raw.slice(0, 3)).toUpperCase();
}

/** Sigla curta do Item da Venda (ex.: "EM", "CR"; renovação vira "R. EM"). */
export function productShortName(name: string): string {
  const raw = (name || "").trim();
  if (!raw) return "?";
  if (isRenewalProduct(raw)) {
    const rest = raw.replace(/^ren(ova[cç][aã]o)?\.?\s*[-:|]?\s*/i, "");
    return `R. ${baseShortName(rest || raw)}`;
  }
  return baseShortName(raw);
}
