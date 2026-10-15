export function transferFavoritesKey(accountId: string, userId: string) {
  return `royzapp:transferFavorites:${accountId}:${userId}`;
}

export function readTransferFavorites(key: string | null): string[] {
  if (!key) return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function prioritizeTransferFavorites<T extends { id: string }>(options: T[], favorites: string[]): T[] {
  const ids = new Set(favorites);
  return [...options].sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)));
}