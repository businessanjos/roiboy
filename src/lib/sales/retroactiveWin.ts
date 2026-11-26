/** Uses the same administrator identity as usePermissions; job titles are not grants. */
export function canLaunchRetroactiveWin(user: { role?: string | null; is_also_admin?: boolean | null } | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "super_admin" || user?.is_also_admin === true;
}

export function saoPauloDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isRetroactiveWinDay(day: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T12:00:00-03:00`);
  return Number.isFinite(date.getTime()) && saoPauloDay(date) === day && day < saoPauloDay(now);
}

export function retroactiveWinAt(day: string, isAdmin: boolean, now = new Date()): string {
  if (!isAdmin) throw new Error("Somente administradores podem lançar ganho retroativo.");
  if (!isRetroactiveWinDay(day, now)) throw new Error("Escolha uma data válida anterior a hoje.");
  // Midday preserves the selected Brazilian calendar day, independent of the browser zone.
  return new Date(`${day}T12:00:00-03:00`).toISOString();
}