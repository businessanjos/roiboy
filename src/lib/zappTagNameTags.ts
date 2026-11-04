/**
 * Preferência de exibição: mostrar ou não as etiquetas ao lado do nome da
 * conversa (lista do RoyZapp e topo do chat).
 *
 * É só apresentação: guarda no navegador de cada pessoa, separada por conta e
 * por usuário, e não muda etiquetas, permissões nem dados.
 */
const BASE_KEY = "royzapp:tagNameTags";

export function tagNameTagsKey(accountId?: string | null, userId?: string | null) {
  return `${BASE_KEY}:${accountId || "anon"}:${userId || "anon"}`;
}

/** Sem valor salvo = mostrado (padrão ligado). */
export function readTagNameTagsEnabled(key: string | null): boolean {
  if (!key) return true;
  try {
    const value = localStorage.getItem(key);
    return value === null ? true : value === "true";
  } catch {
    return true;
  }
}

const listeners = new Set<() => void>();

function emit() {
  for (const listener of [...listeners]) listener();
}

export function writeTagNameTagsEnabled(key: string | null, enabled: boolean) {
  if (!key) return;
  try {
    localStorage.setItem(key, enabled ? "true" : "false");
  } catch {
    // Sem armazenamento disponível: a preferência só não persiste.
  }
  emit();
}

export function subscribeTagNameTags(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Aba diferente na mesma conta: mantém as telas em sincronia.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key.startsWith(BASE_KEY)) emit();
  });
}
