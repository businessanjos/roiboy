/** Presentation only: technical accounts are not people, without changing their access. */
export const TV_ACCOUNT_USER_ID = "4cd93864-3689-4835-bddf-91e2960e7860";
export const TV_ACCOUNT_AUTH_ID = "4e6afeac-2c22-4e20-805f-dba140036027";
export const TV_ACCOUNT_EMAIL = "tv-escritorio@iamroy.app";

interface PersonIdentity {
  id?: string | null;
  auth_user_id?: string | null;
  name?: string | null;
  email?: string | null;
}

const normalize = (value: string | null | undefined) => (value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

export function isHiddenTechnicalPerson(person: PersonIdentity | null | undefined): boolean {
  if (!person) return false;
  return person.id === TV_ACCOUNT_USER_ID || person.id === TV_ACCOUNT_AUTH_ID
    || person.auth_user_id === TV_ACCOUNT_AUTH_ID
    || normalize(person.email) === TV_ACCOUNT_EMAIL
    || normalize(person.name) === "tv escritorio";
}

export function filterVisiblePeople<T extends PersonIdentity>(people: readonly T[] | null | undefined): T[] {
  return (people ?? []).filter((person) => !isHiddenTechnicalPerson(person));
}

/** Apply before pagination/counting; never use for current-user, auth or permission reads. */
export function visiblePeopleQuery<T>(query: T): T {
  // Keep the generated schema type opaque here to avoid recursively comparing its builders.
  const builder = query as { neq: (column: string, value: string) => unknown };
  return builder.neq("id", TV_ACCOUNT_USER_ID) as T;
}