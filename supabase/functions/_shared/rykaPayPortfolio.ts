// Read-model of the whole Clínica Ryka portfolio in RykaPay (dashboard "Assinaturas" in Vendas).
// Pure: shared by the edge function and by the ROY presentation/tests.
import { CR_PAY_PRODUCTS, CR_STRIPE_LEGACY_CYCLE_CENTS, activePaySubscription, isClinicaRykaSale, normalizeProduct, normalizeStripeLegacy, record } from "./rykaPay.ts";

export type PortfolioInvoice = {
  id: string;
  amountCents: number | null;
  dueDate: string | null;
  paidAt: string | null;
  /** Provider situation: "pago", "pendente", "cancelado" or another provider word. */
  situation: string;
};
export type PortfolioContract = {
  id: string;
  /** "avulso": a paid one-off (entry, single cycle) that is cash but not recurring revenue. */
  kind: "mensal" | "anual" | "avulso";
  source: "rykapay" | "stripe_legacy";
  status: string;
  /** Provider says the contract is running (annual: sale still paid). */
  active: boolean;
  /** Monthly: value of one cycle. */
  cycleCents: number | null;
  /** Annual / one-off: total of the sale. */
  totalCents: number | null;
  startedOn: string | null;
  nextChargeOn: string | null;
  canceledAt: string | null;
  productName: string;
  invoices: PortfolioInvoice[];
};
export type PortfolioClinic = {
  dealId: string;
  name: string;
  sellerId: string | null;
  sellerName: string | null;
  wonAt: string | null;
  /** "needs_document": ROY has no CPF/CNPJ/e-mail to look this clinic up. */
  state: "found" | "not_found" | "needs_document";
  /** A manager released this win without a located payment: the manager took it on, so it is not a pending "sem dono" item. */
  releasedBy?: string | null;
  contracts: PortfolioContract[];
};
/** Activity title written by the win flow when a manager releases a CR win without a located payment. */
export const PAY_RELEASE_NOTE_TITLE = "Ganho liberado sem pagamento no RykaPay";
export type PayPortfolio = { generatedAt: string; partial: boolean; clinics: PortfolioClinic[] };

const text = (v: unknown, max = 200) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const cents = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
const date = (v: unknown) => { const s = text(v); return s && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s) && Number.isFinite(Date.parse(s)) ? s : null; };
const CANCELLED_SALE = ["cancelada", "cancelado", "expirada", "estornada", "chargeback"];

/** A contract only exists for the dashboard once something was really paid (abandoned checkouts are not sales). */
export function hasPaidInvoice(contract: Pick<PortfolioContract, "invoices">): boolean {
  return contract.invoices.some(f => f.situation === "pago");
}
function isProgramSubscription(r: Record<string, unknown>): boolean {
  const productId = text(r.produto_id) || text(record(r.produto).id);
  return Boolean(productId && CR_PAY_PRODUCTS[productId]) || isClinicaRykaSale(r.descricao) || isClinicaRykaSale(r.produto_nome);
}
function invoiceOf(raw: unknown, paidWord?: string): PortfolioInvoice | null {
  const f = record(raw);
  const id = text(f.id);
  if (!id) return null;
  const status = text(f.status, 40) || "";
  const situation = text(f.situacao, 40)
    || (paidWord && status === paidWord ? "pago" : ["estornado", "cancelado", "chargeback"].includes(status) ? "cancelado" : "pendente");
  return {
    id,
    amountCents: cents(f.valor_centavos) ?? cents(f.valor_bruto_centavos),
    dueDate: date(f.vencimento),
    paidAt: date(f.pago_em) ?? date(f.recebimento),
    situation,
  };
}
function invoicesOf(list: unknown, paidWord?: string): PortfolioInvoice[] | null {
  if (!Array.isArray(list)) return null;
  const invoices = list.map(v => invoiceOf(v, paidWord));
  return invoices.some(f => !f) ? null : [...new Map((invoices as PortfolioInvoice[]).map(f => [f.id, f])).values()];
}
/** One-off sale of the program: annual plan, or plain cash when it is an entry / a single subscription cycle. */
function saleContract(raw: unknown, paidWord?: string): PortfolioContract | null {
  const r = record(raw);
  const id = text(r.id);
  const name = text(r.descricao) || text(r.produto_nome);
  const invoices = invoicesOf(r.parcelas, paidWord);
  if (!id || !name || !invoices || !isClinicaRykaSale(name)) return null;
  const status = text(r.status, 40) || "Não informado";
  const oneOff = /entrada|ciclo|mensal/.test(normalizeProduct(name));
  const paidDays = invoices.map(f => f.paidAt).filter((v): v is string => Boolean(v)).sort();
  return {
    id,
    kind: oneOff ? "avulso" : "anual",
    source: "rykapay",
    status,
    active: !CANCELLED_SALE.includes(status.toLowerCase()),
    cycleCents: null,
    totalCents: cents(r.valor_total_centavos),
    startedOn: date(r.paga_em) ?? paidDays[0] ?? date(r.criada_em),
    nextChargeOn: null,
    canceledAt: date(r.cancelada_em),
    productName: name,
    invoices,
  };
}
/** Contracts of the Clínica Ryka program inside one "payments by customer" answer; never throws on odd rows. */
export function portfolioContractsFromPay(rawData: unknown): { contracts: PortfolioContract[]; partial: boolean } {
  const data = record(rawData);
  const contracts: PortfolioContract[] = [];
  let partial = data.parcial === true;
  for (const raw of Array.isArray(data.assinaturas) ? data.assinaturas : []) {
    const r = record(raw);
    if (!isProgramSubscription(r)) continue;
    const id = text(r.id) || text(r.checkout_id);
    const invoices = invoicesOf(r.faturas);
    if (!id || !invoices) { partial = true; continue; }
    const status = text(r.status, 40) || "Não informado";
    const period = (text(r.periodicidade, 40) || "").toLowerCase();
    contracts.push({
      id,
      kind: ["anual", "annual"].includes(period) ? "anual" : "mensal",
      source: "rykapay",
      status,
      active: activePaySubscription(status),
      cycleCents: cents(r.valor_ciclo_centavos),
      totalCents: null,
      startedOn: date(r.inicio),
      nextChargeOn: date(r.proxima_cobranca),
      canceledAt: date(r.cancelada_em),
      productName: text(r.descricao) || text(r.produto_nome) || "Programa Clínica Ryka",
      invoices,
    });
  }
  for (const raw of Array.isArray(data.cobrancas_avulsas) ? data.cobrancas_avulsas : []) {
    if (!isClinicaRykaSale(record(raw).descricao) && !isClinicaRykaSale(record(raw).produto_nome)) continue;
    const contract = saleContract(raw);
    if (contract) contracts.push(contract); else partial = true;
  }
  return { contracts: contracts.filter(hasPaidInvoice), partial };
}
/** A sale read from the RykaPay charges route (a manager linked it to the deal). */
export function portfolioContractFromSale(raw: unknown): PortfolioContract | null {
  const contract = saleContract(raw, "recebido");
  return contract && hasPaidInvoice(contract) ? contract : null;
}
/** Old Stripe subscription of the program; null when the Stripe part is unavailable. */
export function portfolioContractFromStripe(rawStripe: unknown, onlyId?: string): PortfolioContract | null | undefined {
  const legacy = normalizeStripeLegacy(rawStripe, onlyId);
  if (!legacy) return null;
  const sub = legacy[0];
  if (!sub) return undefined;
  const raw = (record(rawStripe).assinaturas as unknown[]).map(record).find(a => a.id === sub.id) ?? {};
  return {
    id: sub.id,
    kind: "mensal",
    source: "stripe_legacy",
    status: sub.status,
    active: activePaySubscription(sub.status),
    cycleCents: CR_STRIPE_LEGACY_CYCLE_CENTS,
    totalCents: null,
    startedOn: date(raw.inicio) ?? sub.invoices[0]?.paidAt ?? null,
    nextChargeOn: date(raw.proxima_cobranca),
    canceledAt: date(raw.cancelada_em),
    productName: sub.productName,
    invoices: sub.invoices.map(f => ({ id: f.id, amountCents: f.amountCents, dueDate: f.dueDate, paidAt: f.paidAt, situation: f.situation })),
  };
}
