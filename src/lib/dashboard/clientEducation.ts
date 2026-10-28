/**
 * Formações (campo `clients.education`) para o dashboard.
 *
 * O valor é texto livre digitado por quem cadastra o cliente, então aqui apenas
 * agrupamos variações de maiúsculas/acentos ("ADMINISTRAÇÃO" = "Administração")
 * e mantemos as palavras que o usuário escolheu — sem renomear nenhuma formação.
 */

export const EDUCATION_ALL = "all";
export const EDUCATION_NONE = "__none__";

const strip = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Chave de agrupamento: mesma formação em caixas/acentos diferentes → mesma chave. */
export function educationKey(raw?: string | null): string {
  if (!raw) return "";
  return strip(raw);
}

/** Mantém as palavras escolhidas pelo usuário; só ajusta a capitalização. */
export function displayEducation(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  // "ADMINISTRAÇÃO" → "Administração"
  if (clean === clean.toUpperCase()) {
    return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1).toLocaleLowerCase("pt-BR");
  }
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

export interface EducationOption {
  /** Chave usada no filtro (educationKey) ou EDUCATION_NONE. */
  value: string;
  label: string;
  count: number;
}

/** Monta as opções de formação a partir dos valores existentes nos clientes. */
export function buildEducationOptions(values: Array<string | null | undefined>): EducationOption[] {
  const groups = new Map<string, { label: string; count: number }>();
  let withoutEducation = 0;

  for (const raw of values) {
    const key = educationKey(raw);
    if (!key) {
      withoutEducation += 1;
      continue;
    }
    const label = displayEducation(raw ?? "");
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { label, count: 1 });
      continue;
    }
    current.count += 1;
    // Prefere o rótulo escrito em caixa mista (evita manter "ADMINISTRAÇÃO").
    if (current.label === current.label.toUpperCase() && label !== label.toUpperCase()) {
      current.label = label;
    }
  }

  const options = Array.from(groups.entries())
    .map(([value, group]) => ({ value, label: group.label, count: group.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));

  if (withoutEducation > 0) {
    options.push({ value: EDUCATION_NONE, label: "Sem formação informada", count: withoutEducation });
  }

  return options;
}

/** O cliente pertence ao filtro de formação escolhido? */
export function educationMatches(raw: string | null | undefined, filter: string): boolean {
  if (filter === EDUCATION_ALL) return true;
  const key = educationKey(raw);
  if (filter === EDUCATION_NONE) return key === "";
  return key === filter;
}

/** Rótulo legível do filtro ativo (para textos de resumo). */
export function educationFilterLabel(options: EducationOption[], filter: string): string | null {
  if (filter === EDUCATION_ALL) return null;
  return options.find((o) => o.value === filter)?.label ?? "Formação selecionada";
}
