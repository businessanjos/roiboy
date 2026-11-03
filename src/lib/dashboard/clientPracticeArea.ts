/**
 * Áreas de atuação (campo `clients.business_niche`) para o dashboard.
 *
 * O campo guarda várias áreas numa única string separada por vírgulas
 * (ex.: "Corporal, Emagrecimento, Facial"), escolhidas no multi-select que lê
 * `practice_areas`. Aqui só agrupamos variações de maiúsculas/acentos e
 * mantemos as palavras que o usuário escreveu — sem renomear nenhuma área.
 */

export const PRACTICE_AREA_ALL = "all";
export const PRACTICE_AREA_NONE = "__none__";

const strip = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Separa a string salva em áreas individuais. */
export function splitPracticeAreas(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Chave de agrupamento: mesma área em caixas/acentos diferentes → mesma chave. */
export function practiceAreaKey(raw?: string | null): string {
  if (!raw) return "";
  return strip(raw);
}

/** Mantém as palavras escolhidas pelo usuário; só ajusta a capitalização. */
export function displayPracticeArea(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  // "FACIAL" → "Facial"
  if (clean === clean.toUpperCase()) {
    return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1).toLocaleLowerCase("pt-BR");
  }
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

export interface PracticeAreaOption {
  /** Chave usada no filtro (practiceAreaKey) ou PRACTICE_AREA_NONE. */
  value: string;
  label: string;
  count: number;
}

/**
 * Conta quantos clientes têm cada área. Um cliente com várias áreas entra em
 * todas elas — por isso a soma pode passar do total de clientes.
 */
export function buildPracticeAreaOptions(
  values: Array<string | null | undefined>,
): PracticeAreaOption[] {
  const groups = new Map<string, { label: string; count: number }>();
  let withoutArea = 0;

  for (const raw of values) {
    const areas = splitPracticeAreas(raw);
    if (areas.length === 0) {
      withoutArea += 1;
      continue;
    }
    // "Facial, facial" não conta duas vezes para o mesmo cliente.
    const seen = new Set<string>();
    for (const area of areas) {
      const key = practiceAreaKey(area);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const label = displayPracticeArea(area);
      const current = groups.get(key);
      if (!current) {
        groups.set(key, { label, count: 1 });
        continue;
      }
      current.count += 1;
      // Prefere o rótulo escrito em caixa mista (evita manter "FACIAL").
      if (current.label === current.label.toUpperCase() && label !== label.toUpperCase()) {
        current.label = label;
      }
    }
  }

  const options = Array.from(groups.entries())
    .map(([value, group]) => ({ value, label: group.label, count: group.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));

  if (withoutArea > 0) {
    options.push({
      value: PRACTICE_AREA_NONE,
      label: "Sem área informada",
      count: withoutArea,
    });
  }

  return options;
}

/** O cliente tem a área filtrada? */
export function practiceAreaMatches(raw: string | null | undefined, filter: string): boolean {
  if (filter === PRACTICE_AREA_ALL) return true;
  const areas = splitPracticeAreas(raw);
  if (filter === PRACTICE_AREA_NONE) return areas.length === 0;
  const wanted = practiceAreaKey(filter);
  return areas.some((area) => practiceAreaKey(area) === wanted);
}

/** Rótulo legível do filtro ativo (para textos de resumo). */
export function practiceAreaFilterLabel(
  options: PracticeAreaOption[],
  filter: string,
): string | null {
  if (filter === PRACTICE_AREA_ALL) return null;
  return options.find((o) => o.value === filter)?.label ?? "Área selecionada";
}
