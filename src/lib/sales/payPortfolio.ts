/**
 * Números do painel "Assinaturas" de Vendas. Tudo sai da leitura do RykaPay
 * (PayPortfolio); nenhum valor digitado no ROY entra aqui.
 */
import { hasPaidInvoice } from "../../../supabase/functions/_shared/rykaPayPortfolio";
import type { PayPortfolio, PortfolioClinic, PortfolioContract, PortfolioInvoice } from "../../../supabase/functions/_shared/rykaPayPortfolio";

export type { PayPortfolio, PortfolioClinic, PortfolioContract };

/**
 * Ganhos de CR que ainda pedem ação em "Pagamentos sem dono": sem pagamento localizado
 * e sem liberação da gestão (quem liberou o ganho assumiu o caso).
 */
export const unmatchedClinics = (clinics: PortfolioClinic[]) => clinics.filter(c => !c.contracts.length && !c.releasedBy);

/** Dia em São Paulo (yyyy-MM-dd): a competência segue a data real da cobrança. */
export function payDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(time)) : null;
}
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthLabel = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
export const monthLongLabel = (month: string) => `${MONTHS_FULL[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;

export const formatBRL = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
export const formatBRLShort = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
export const formatPercent = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;

export type PortfolioPeriod = { from: string | null; to: string };
export type PeriodKey = "month" | "3m" | "12m" | "all";
export const PERIOD_LABELS: Record<PeriodKey, string> = { all: "Todo o período", month: "Este mês", "3m": "Últimos 3 meses", "12m": "Últimos 12 meses" };
export function periodFor(key: PeriodKey, today: string): PortfolioPeriod {
  const month = today.slice(0, 7);
  if (key === "all") return { from: null, to: today };
  return { from: `${addMonths(month, key === "month" ? 0 : key === "3m" ? -2 : -11)}-01`, to: today };
}
const inPeriod = (day: string | null, p: PortfolioPeriod) => Boolean(day && day <= p.to && (!p.from || day >= p.from));

const recurring = (c: PortfolioContract) => (c.kind === "mensal" || c.kind === "anual") && hasPaidInvoice(c);
const paidDay = (f: PortfolioInvoice) => f.situation === "pago" ? payDay(f.paidAt) ?? payDay(f.dueDate) : null;
function startDay(c: PortfolioContract): string | null {
  return payDay(c.startedOn) ?? c.invoices.map(paidDay).filter((v): v is string => Boolean(v)).sort()[0] ?? null;
}
/** Plano anual vale 12 meses a partir do início; depois disso ele termina sozinho (não é cancelamento). */
function annualEnd(c: PortfolioContract): string | null {
  const start = startDay(c);
  return c.kind === "anual" && start ? `${addMonths(start.slice(0, 7), 12)}-${start.slice(8)}` : null;
}
/** Dia em que o contrato foi cancelado; sem data do RykaPay, vale a última movimentação dele. */
export function cancelDay(c: PortfolioContract): string | null {
  const stated = payDay(c.canceledAt);
  if (stated) return stated;
  if (c.active) return null;
  return c.invoices.flatMap(f => [payDay(f.paidAt), payDay(f.dueDate)]).filter((v): v is string => Boolean(v)).sort().pop() ?? startDay(c);
}
export function isLiveOn(c: PortfolioContract, day: string): boolean {
  if (!recurring(c)) return false;
  const start = startDay(c);
  if (!start || start > day) return false;
  const cancelled = cancelDay(c);
  if (cancelled && cancelled <= day) return false;
  const end = annualEnd(c);
  return !end || day < end;
}
/** Receita mensal do contrato: mensalidade, ou o valor anual ÷ 12. */
export function contractMrr(c: PortfolioContract): number {
  return c.kind === "mensal" ? c.cycleCents ?? 0 : c.kind === "anual" ? Math.round((c.totalCents ?? 0) / 12) : 0;
}
const clinicMrr = (clinic: PortfolioClinic, day: string) => clinic.contracts.filter(c => isLiveOn(c, day)).reduce((s, c) => s + contractMrr(c), 0);
const clinicLive = (clinic: PortfolioClinic, day: string) => clinic.contracts.some(c => isLiveOn(c, day));
const openInvoice = (f: PortfolioInvoice) => f.situation !== "pago" && f.situation !== "cancelado";
/** Em atraso: contrato vigente com parcela vencida em aberto, ou marcado como inadimplente no RykaPay. */
export function isOverdue(c: PortfolioContract, today: string): boolean {
  if (!isLiveOn(c, today)) return false;
  return ["inadimplente", "past_due", "suspensa", "suspended"].includes(c.status.toLowerCase())
    || c.invoices.some(f => openInvoice(f) && Boolean(payDay(f.dueDate)) && (payDay(f.dueDate) as string) < today);
}
const paidCents = (clinic: PortfolioClinic, p?: PortfolioPeriod) => clinic.contracts.flatMap(c => c.invoices)
  .filter(f => { const d = paidDay(f); return d && (!p || inPeriod(d, p)); }).reduce((s, f) => s + (f.amountCents ?? 0), 0);

export interface PortfolioCancellation {
  dealId: string;
  clinic: string;
  date: string;
  kind: "Mensal" | "Anual";
  seller: string | null;
  lostMrrCents: number;
  receivedCents: number;
}
/** Clínica com contrato vigente hoje, para a lista aberta pelo cartão "Clínicas Ativas". */
export interface PortfolioActiveClinic {
  dealId: string;
  clinic: string;
  seller: string | null;
  kind: "Mensal" | "Anual";
  /** Início do contrato vigente mais antigo. */
  since: string | null;
  mrrCents: number;
  receivedCents: number;
  overdue: boolean;
}
export interface PortfolioMetrics {
  mrrCents: number;
  activeClinics: number;
  /** As mesmas clínicas contadas em `activeClinics`, da maior receita mensal para a menor. */
  activeList: PortfolioActiveClinic[];
  annual: { mrrCents: number; arrCents: number };
  monthly: { mrrCents: number; arrCents: number };
  mrrSeries: { month: string; mrrCents: number }[];
  activations: { month: string; count: number }[];
  cashflow: { month: string; receivedCents: number; receivableCents: number; projected: boolean }[];
  /** Primeiro mês do fluxo que é só previsão. */
  projectionFrom: string;
  ranking: { seller: string; receivedCents: number; activeClinics: number }[];
  health: { activeClinics: number; upToDate: number; rate: number | null };
  cancellations: {
    inPeriod: number; total: number; lostMrrCents: number; churn: number | null; retention: number | null;
    atRisk: number; atRiskMrrCents: number; byMonth: { month: string; count: number }[]; list: PortfolioCancellation[];
  };
  /** Negócios ganhos que o RykaPay não localizou (não entram em nenhum número). */
  notFound: number;
}

export function portfolioMetrics(portfolio: PayPortfolio, today: string, period: PortfolioPeriod): PortfolioMetrics {
  const clinics = portfolio.clinics;
  const month = today.slice(0, 7);
  const live = clinics.filter(c => clinicLive(c, today));
  const sumLive = (kind: "mensal" | "anual") => clinics.flatMap(c => c.contracts).filter(c => c.kind === kind && isLiveOn(c, today));
  const monthlyMrr = sumLive("mensal").reduce((s, c) => s + contractMrr(c), 0);
  const annualArr = sumLive("anual").reduce((s, c) => s + (c.totalCents ?? 0), 0);
  const annualMrr = sumLive("anual").reduce((s, c) => s + contractMrr(c), 0);

  const last12 = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 11));
  const mrrSeries = last12.map(m => {
    const day = m === month ? today : monthEnd(m);
    return { month: m, mrrCents: clinics.reduce((s, c) => s + clinicMrr(c, day), 0) };
  });
  const firstStart = (clinic: PortfolioClinic) => clinic.contracts.filter(recurring).map(startDay).filter((v): v is string => Boolean(v)).sort()[0] ?? null;
  const activations = last12.map(m => ({ month: m, count: clinics.filter(c => firstStart(c)?.slice(0, 7) === m).length }));

  // Fluxo de caixa: 6 meses realizados (com o atual) + 6 previstos, pela data real de cada cobrança.
  const flowMonths = Array.from({ length: 12 }, (_, i) => addMonths(month, i - 5));
  const flow = new Map(flowMonths.map(m => [m, { received: 0, receivable: 0 }]));
  for (const contract of clinics.flatMap(c => c.contracts)) {
    const billed = new Set<string>();
    const running = contract.kind === "avulso" ? contract.active : isLiveOn(contract, today);
    for (const f of contract.invoices) {
      const paid = paidDay(f);
      const due = payDay(f.dueDate);
      if (paid) { billed.add((due ?? paid).slice(0, 7)); const slot = flow.get(paid.slice(0, 7)); if (slot) slot.received += f.amountCents ?? 0; }
      else if (openInvoice(f) && due && running) { billed.add(due.slice(0, 7)); const slot = flow.get(due.slice(0, 7)); if (slot) slot.receivable += f.amountCents ?? 0; }
    }
    // Mensalidades futuras de assinatura vigente ainda sem fatura emitida.
    const next = payDay(contract.nextChargeOn);
    if (contract.kind === "mensal" && running && next && contract.cycleCents) {
      for (let m = next.slice(0, 7) < month ? month : next.slice(0, 7); flow.has(m); m = addMonths(m, 1)) {
        if (!billed.has(m)) (flow.get(m) as { receivable: number }).receivable += contract.cycleCents;
      }
    }
  }
  const cashflow = flowMonths.map(m => ({ month: m, receivedCents: flow.get(m)!.received, receivableCents: flow.get(m)!.receivable, projected: m > month }));

  const sellers = new Map<string, { seller: string; receivedCents: number; activeClinics: number }>();
  for (const clinic of clinics) {
    if (!clinic.contracts.length) continue;
    const seller = clinic.sellerName || "Sem vendedor";
    const row = sellers.get(seller) ?? { seller, receivedCents: 0, activeClinics: 0 };
    row.receivedCents += paidCents(clinic, period);
    if (clinicLive(clinic, today)) row.activeClinics += 1;
    sellers.set(seller, row);
  }
  const ranking = [...sellers.values()].filter(r => r.receivedCents > 0 || r.activeClinics > 0)
    .sort((a, b) => b.receivedCents - a.receivedCents || b.activeClinics - a.activeClinics || a.seller.localeCompare(b.seller)).slice(0, 8);

  const risky = live.filter(clinic => clinic.contracts.some(c => isOverdue(c, today)));

  // Saída = clínica sem nenhum contrato vigente hoje cujo último contrato foi cancelado (fim natural do anual não conta).
  const exits: PortfolioCancellation[] = [];
  for (const clinic of clinics) {
    if (clinicLive(clinic, today)) continue;
    const last = clinic.contracts.filter(recurring).map(c => ({ c, day: cancelDay(c) }))
      .filter((x): x is { c: PortfolioContract; day: string } => Boolean(x.day) && x.day! <= today && !(annualEnd(x.c) && x.day! >= (annualEnd(x.c) as string)))
      .sort((a, b) => b.day.localeCompare(a.day))[0];
    if (!last) continue;
    exits.push({ dealId: clinic.dealId, clinic: clinic.name, date: last.day, kind: last.c.kind === "anual" ? "Anual" : "Mensal", seller: clinic.sellerName, lostMrrCents: contractMrr(last.c), receivedCents: paidCents(clinic) });
  }
  const list = exits.filter(e => inPeriod(e.date, period)).sort((a, b) => b.date.localeCompare(a.date));
  // Base do churn: clínicas que estiveram vigentes no período (as do início + as que entraram nele).
  const base = clinics.filter(c => !period.from ? c.contracts.some(recurring)
    : clinicLive(c, period.from) || inPeriod(firstStart(c), period)).length;
  const churn = base > 0 ? (list.length / base) * 100 : null;

  const activeList: PortfolioActiveClinic[] = live.map(clinic => {
    const running = clinic.contracts.filter(c => isLiveOn(c, today));
    return {
      dealId: clinic.dealId,
      clinic: clinic.name,
      seller: clinic.sellerName,
      kind: running.some(c => c.kind === "anual") ? "Anual" as const : "Mensal" as const,
      since: running.map(startDay).filter((v): v is string => Boolean(v)).sort()[0] ?? null,
      mrrCents: clinicMrr(clinic, today),
      receivedCents: paidCents(clinic),
      overdue: running.some(c => isOverdue(c, today)),
    };
  }).sort((a, b) => b.mrrCents - a.mrrCents || a.clinic.localeCompare(b.clinic, "pt-BR"));

  return {
    mrrCents: monthlyMrr + annualMrr,
    activeClinics: live.length,
    activeList,
    annual: { mrrCents: annualMrr, arrCents: annualArr },
    monthly: { mrrCents: monthlyMrr, arrCents: monthlyMrr * 12 },
    mrrSeries,
    activations,
    cashflow,
    projectionFrom: addMonths(month, 1),
    ranking,
    health: { activeClinics: live.length, upToDate: live.length - risky.length, rate: live.length ? ((live.length - risky.length) / live.length) * 100 : null },
    cancellations: {
      inPeriod: list.length,
      total: exits.length,
      lostMrrCents: list.reduce((s, e) => s + e.lostMrrCents, 0),
      churn,
      retention: churn === null ? null : Math.max(0, 100 - churn),
      atRisk: risky.length,
      atRiskMrrCents: risky.reduce((s, c) => s + clinicMrr(c, today), 0),
      byMonth: last12.map(m => ({ month: m, count: exits.filter(e => e.date.slice(0, 7) === m).length })),
      list,
    },
    notFound: clinics.filter(c => !c.contracts.length).length,
  };
}
