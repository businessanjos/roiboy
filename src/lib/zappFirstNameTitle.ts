/**
 * Variável {primeiro_nome}: manter ou não títulos (Dr., Dra., Doutor, Doutora)
 * junto ao primeiro nome. Preferência por pessoa (conta + usuário), padrão ligado.
 */
const BASE_KEY = "royzapp:firstNameKeepTitle";

const TITLES = new Set(["dr", "dra", "doutor", "doutora"]);

function isTitle(word: string) {
  return TITLES.has(word.toLowerCase().replace(/\.$/, ""));
}

/** "Dra. Juliana Ribeiro" → "Dra. Juliana" (keepTitle) ou "Juliana". */
export function extractFirstName(fullName: string | null | undefined, keepTitle = true): string {
  const words = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (!isTitle(words[0]) || words.length < 2) return words[0];
  let i = 0;
  while (i < words.length - 1 && isTitle(words[i])) i++;
  return keepTitle ? `${words.slice(0, i).join(" ")} ${words[i]}` : words[i];
}

export function firstNameTitleKey(accountId?: string | null, userId?: string | null) {
  return `${BASE_KEY}:${accountId || "anon"}:${userId || "anon"}`;
}

export function readKeepTitle(key: string | null): boolean {
  if (!key) return true;
  try {
    const v = localStorage.getItem(key);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

const listeners = new Set<() => void>();
const emit = () => [...listeners].forEach((l) => l());

export function writeKeepTitle(key: string | null, enabled: boolean) {
  if (!key) return;
  try {
    localStorage.setItem(key, enabled ? "true" : "false");
  } catch {
    /* sem armazenamento */
  }
  emit();
}

export function subscribeKeepTitle(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === null || e.key.startsWith(BASE_KEY)) emit();
  });
}
