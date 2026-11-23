/** Regra "Início do mês": nos primeiros N dias (fuso de São Paulo) troca o período mensal pelo anual no link entregue à TV. */
export function spDayOfMonth(now: Date = new Date()): number {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", day: "numeric" }).format(now);
  return Number(d);
}

export function monthStartActive(settings: any, screen: any, now: Date = new Date()): boolean {
  const days = Number(settings?.month_start_days ?? 5);
  return !!settings?.month_start_annual && !!screen?.month_start_annual && days >= 1 && spDayOfMonth(now) <= days;
}

const MONTHLY = new Set(["este_mes", "mes"]);

/** Devolve o link com período anual; links fixos em outro período ou de outro tipo voltam sem mudança. */
export function toAnnualUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  let annual: string | null = null;
  if (/\/insights\/[0-9a-f-]{36}$/i.test(u.pathname)) annual = "este_ano";
  else if (u.hostname === "eternum-luxe-hub.lovable.app" && (u.pathname === "/tv" || u.pathname === "/tv-organico")) annual = "ano";
  if (!annual) return url;
  const p = u.searchParams.get("periodo");
  if (p !== null && !MONTHLY.has(p)) return url;
  u.searchParams.set("periodo", annual);
  return u.toString();
}
