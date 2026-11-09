// Guesses grammatical gender from a Brazilian first name to pick "Consultor"/"Consultora".
const MALE_A = new Set(["luca", "joshua", "nicola", "andrea", "jean", "elias", "isaias", "jonas", "lucas", "tomas", "matias"]);
const FEMALE_OTHER = new Set(["raquel", "isabel", "rachel", "ruth", "carmen", "beatriz", "liz", "inês", "ines", "miriam", "ester", "esther", "lourdes", "mercedes", "alice", "denise", "elaine", "simone", "aline", "jaqueline", "jacqueline", "dayse", "daise", "natiely", "nathaly", "kelly", "sueli", "rose", "gisele", "michele", "michelle", "cristiane", "viviane", "luciane", "eliane", "ivone", "yasmin", "jasmin", "carol", "mel", "leoni", "leile", "angelique"]);

export function isMasculineName(name?: string | null): boolean {
  const first = (name ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!first) return false;
  if (FEMALE_OTHER.has(first)) return false;
  if (MALE_A.has(first)) return true;
  return !/a$/.test(first);
}

/** Swaps "Consultora" for the masculine form without renaming variables such as {Nome da consultora}. */
export function genderConsultant(text: string, name?: string | null): string {
  if (!name || !isMasculineName(name)) return text;
  return text.split(/(\{[^}]+\})/g).map((part) => (
    part.startsWith("{") ? part : part.replace(/\b([Cc])onsultora\b/g, "$1onsultor")
  )).join("");
}

const CLIENT_SWAP: [RegExp, string][] = [
  [/\b([Mm])embra(s?)\b/g, "$1embro$2"],
  [/\b([Ss])ócia(s?)\b/g, "$1ócio$2"],
  [/\b([Bb])em-vinda(s?)\b/g, "$1em-vindo$2"],
];

/** Mensagens são escritas no feminino; para cliente homem troca membra/sócia/bem-vinda pelo masculino. */
export function genderClient(text: string, clientName?: string | null): string {
  if (!clientName || !isMasculineName(clientName)) return text;
  return text.split(/(\{[^}]+\})/g).map((part) => (
    part.startsWith("{") ? part : CLIENT_SWAP.reduce((t, [re, to]) => t.replace(re, to), part)
  )).join("");
}
