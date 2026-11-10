/**
 * Pessoas que não devem aparecer em campos de seleção de pessoa dentro do Marketing.
 *
 * Regra do usuário (Lucas dos Santos): "onde tiver campo de seleção assim no
 * marketing, não incluir lucas suporte".
 *
 * Vale para TODO seletor de responsável / vendedor / stakeholder da área.
 * A pessoa continua existindo no cadastro e em outras áreas do sistema.
 */

/** users.id do "Lucas Suporte" (anjosgroup.dados@anjosbusiness.com). */
const HIDDEN_MARKETING_PERSON_IDS = new Set([
  "4385080f-e707-460f-b7ab-489fa3f73150",
]);

/** Nomes comparados sem acento, sem caixa e com espaços colapsados. */
const HIDDEN_MARKETING_PERSON_NAMES = new Set(["lucas suporte"]);

const normalize = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

interface MaybePerson {
  id?: string | null;
  name?: string | null;
  email?: string | null;
}

/** true quando a pessoa deve ficar fora dos seletores de Marketing. */
export function isHiddenMarketingPerson(person: MaybePerson | null | undefined): boolean {
  if (!person) return false;
  if (person.id && HIDDEN_MARKETING_PERSON_IDS.has(person.id)) return true;
  return HIDDEN_MARKETING_PERSON_NAMES.has(normalize(person.name));
}

/** Remove das listas de pessoas as que não devem aparecer em seletores de Marketing. */
export function filterMarketingPeople<T extends MaybePerson>(people: T[] | null | undefined): T[] {
  return (people || []).filter((person) => !isHiddenMarketingPerson(person));
}
