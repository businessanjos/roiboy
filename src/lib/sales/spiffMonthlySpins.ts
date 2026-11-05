/** Regra da Roleta: cada mês de competência é estanque — vendas de meses diferentes não somam. */
export function competenceMonthKey(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

/** Soma de giros calculada mês a mês: floor(total do mês / gatilho) para cada mês. */
export function spinsByMonth<T>(items: T[], getDate: (i: T) => string | null, getAmount: (i: T) => number, trigger: number): number {
  if (!(trigger > 0)) return 0;
  const totals = new Map<string, number>();
  for (const i of items) {
    const k = competenceMonthKey(getDate(i));
    if (!k) continue;
    totals.set(k, (totals.get(k) ?? 0) + getAmount(i));
  }
  let spins = 0;
  for (const t of totals.values()) spins += Math.floor(t / trigger);
  return spins;
}
