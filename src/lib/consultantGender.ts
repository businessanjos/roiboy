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

/** Swaps "Consultora(s)" for the masculine form when the consultant's name is masculine. */
export function genderConsultant(text: string, name?: string | null): string {
  if (!name || !isMasculineName(name)) return text;
  return text.replace(/\b([Cc])onsultora\b/g, "$1onsultor");
}
