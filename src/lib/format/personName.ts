const LOWER_WORDS = new Set([
  "de", "da", "das", "do", "dos", "e", "di", "du", "del", "della", "van", "von", "y",
]);

/**
 * Formata nomes próprios: "LUCAS GABRIEL DOS SANTOS" -> "Lucas Gabriel dos Santos".
 * Nomes já com mistura de maiúsculas/minúsculas são preservados.
 */
export function formatPersonName(name?: string | null): string {
  const raw = (name || "").trim();
  if (!raw) return "";
  // Só normaliza quando está tudo em caixa alta (ou tudo minúsculo).
  const isAllCaps = raw === raw.toUpperCase() && /[A-ZÀ-Ý]/.test(raw);
  const isAllLower = raw === raw.toLowerCase() && /[a-zà-ÿ]/.test(raw);
  if (!isAllCaps && !isAllLower) return raw;

  return raw
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && LOWER_WORDS.has(lower)) return lower;
      if (/^[ivxlc]{2,}$/i.test(word)) return word.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
