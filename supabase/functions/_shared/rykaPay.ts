// Pure read-model shared by the server and the ROY presentation/tests.
export type PayInvoice = {
  id: string;
  cycle: number | null;
  status: string;
  situation: string;
  amountCents: number | null;
  dueDate: string | null;
  paidAt: string | null;
};
export type PaySubscription = {
  id: string;
  productId: string | null;
  productName: string;
  status: string;
  period: string;
  invoices: PayInvoice[];
  /** "stripe_legacy": closed list of old Stripe subscriptions; "linked_sale": a RykaPay sale a manager linked to the deal. */
  source?: "subscription" | "annual_sale" | "stripe_legacy" | "linked_sale";
  royProductColor?: string | null;
};
export type PayResult = {
  state: "ready" | "not_found" | "needs_document" | "needs_product";
  subscriptions: PaySubscription[];
  partial: boolean;
  generatedAt: string;
  productName: string | null;
  /** How the payer was found; "email" means the document found nothing. */
  matchedBy?: "document" | "email" | null;
  /** True when RykaPay has a payer for the document/e-mail, even if nothing is shown. */
  payerFound?: boolean;
  /** Set when the payment was found through a third-party payer a manager approved, not the client's own data. */
  paidBy?: PayPaidBy | null;
  /** RykaPay records left out (other product or not active), product/status only. */
  skipped?: PaySkipped[];
};
export type PayRelationship = "partner" | "spouse" | "company_card" | "other";
export type PayPaidBy = {
  name: string;
  relationship: PayRelationship;
  relationshipOther: string | null;
  /** True when the manager approved this payer for the deal being read; otherwise the seller must confirm. */
  forThisDeal: boolean;
};
export const PAY_RELATIONSHIP_LABEL: Record<PayRelationship, string> = {
  partner: "Sócio",
  spouse: "Marido/Esposa",
  company_card: "Cartão da empresa",
  other: "Outro",
};
export function payRelationshipLabel(paidBy: Pick<PayPaidBy, "relationship" | "relationshipOther">): string {
  return paidBy.relationship === "other" && paidBy.relationshipOther ? paidBy.relationshipOther : PAY_RELATIONSHIP_LABEL[paidBy.relationship];
}
export type PaySkipped = { kind: "subscription" | "charge"; productName: string; status: string };
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}
function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function date(value: unknown): string | null {
  const s = text(value);
  return s && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s) && Number.isFinite(Date.parse(s)) ? s : null;
}
export function documentNumbers(value: unknown): string | null {
  const n = typeof value === "string" ? value.replace(/\D/g, "") : "";
  return n.length === 11 || n.length === 14 ? n : null;
}
export function normalizeProduct(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}
export function matchesPayProduct(subscription: PaySubscription, product: { id: string; name: string }): boolean {
  return subscription.productId === product.id || normalizeProduct(subscription.productName) === normalizeProduct(product.name)
    || (product.id === CR_PRODUCT_ID && (Boolean(subscription.productId && CR_PAY_PRODUCTS[subscription.productId])
      || (subscription.source === "annual_sale" && CR_PAY_ANNUAL_NAMES.has(normalizeProduct(subscription.productName)))));
}
export const CR_PRODUCT_ID = "feb34040-ba60-417a-a5d3-66dbdf1cfc02";
// Catalogue IDs inspected on 26/11/2026; Lucas confirmed these plans are the ROY CR program.
export const CR_PAY_PRODUCTS: Record<string, "mensal" | "anual"> = {
  "394f0bba-b598-4cbd-97ff-c1f53d9d3f2d": "anual",
  "8064900c-fd24-4f90-8682-cd6cdfd36b4e": "anual",
  "cd519184-60ca-4c4c-99ad-26573765b6db": "anual",
  "2bce344b-944a-4b65-bc1b-7a9c74c806db": "anual",
  "c4a4809c-1fef-4a65-88b4-8a64d845babc": "anual",
  "32f5ad99-514f-4a67-889e-cfdea0b8d485": "mensal",
  "6c041c90-2825-44cb-9e88-bc9f2539d67e": "mensal",
  "be8132b2-adda-4468-93bb-6388b75632d7": "mensal",
  "9904ef28-1d56-4433-b7e1-0dd72ff9ac98": "mensal",
};
// The payments-by-customer route returns annual sales without a product ID: only the
// description, which is the catalogue name of the plan sold (inspected on 26/11/2026).
export const CR_PAY_ANNUAL_NAMES = new Set([
  "[ANUAL] Programa Clinica Ryka",
  "[ANUAL] Programa Clinica Ryka - A Vista",
  "[ANUAL] Programa Clinica Ryka 12x",
].map(normalizeProduct));
export function activePaySubscription(status: string): boolean {
  return ["ativa", "ativo", "active", "inadimplente", "suspensa", "suspended", "past_due"].includes(status.toLowerCase());
}
export function normalizePaySubscription(raw: unknown): PaySubscription {
  const r = record(raw);
  const product = record(r.produto);
  const id = text(r.checkout_id) || text(r.id) || text(r.assinatura_id);
  if (!id || !Array.isArray(r.faturas)) throw new Error("invalid_pay_response");
  const invoices = r.faturas.map((rawInvoice): PayInvoice => {
    const f = record(rawInvoice);
    const fid = text(f.id);
    if (!fid) throw new Error("invalid_pay_response");
    return {
      id: fid,
      cycle: integer(f.ciclo),
      status: text(f.status) || "Não informado",
      situation: text(f.situacao) || "outro",
      amountCents: integer(f.valor_centavos),
      dueDate: date(f.vencimento),
      paidAt: date(f.pago_em),
    };
  });
  return {
    id,
    productId: text(r.produto_id) || text(product.id),
    productName: text(r.produto_nome) || text(product.nome) || text(r.nome_produto) || "Produto não informado",
    status: text(r.status) || "Não informado",
    period: text(r.periodicidade) || "Não informada",
    invoices: [...new Map(invoices.map(f => [f.id, f])).values()],
  };
}
export function normalizeAnnualSale(raw: unknown): PaySubscription | null {
  const r = record(raw);
  const p = record(r.produto);
  const productId = text(r.produto_id) || text(p.id);
  const soldName = text(r.produto_nome) || text(p.nome) || text(r.descricao);
  if (productId ? CR_PAY_PRODUCTS[productId] !== "anual" : !(soldName && CR_PAY_ANNUAL_NAMES.has(normalizeProduct(soldName)))) return null;
  if (["cancelada", "cancelado", "expirada", "estornada", "chargeback"].includes(String(r.status).toLowerCase())) return null;
  if (!Array.isArray(r.parcelas)) throw new Error("invalid_pay_response");
  return {
    ...normalizePaySubscription({
      ...r,
      id: text(r.id) || text(r.venda_id),
      produto_id: productId,
      produto_nome: soldName,
      periodicidade: "anual",
      faturas: r.parcelas.map(v => { const f = record(v); return { ...f, ciclo: f.parcela }; }),
    }),
    source: "annual_sale",
  };
}
export function payMetrics(subscriptions: PaySubscription[], partial: boolean): { paidCents: number | null; upcoming: number | null } {
  const invoices = [...new Map(subscriptions.flatMap(s => s.invoices).map(f => [f.id, f])).values()];
  if (partial || invoices.some(f => f.amountCents === null || f.situation === "outro")) return { paidCents: null, upcoming: null };
  return {
    paidCents: invoices.filter(f => f.situation === "pago").reduce((sum, f) => sum + (f.amountCents ?? 0), 0),
    // The provider's normalized situation owns overdue classification, not the device clock.
    upcoming: invoices.filter(f => f.situation === "pendente").length,
  };
}
export function payCycleLabel(period: string, cycle: number | null): string {
  if (cycle === null || cycle < 1) return "—";
  if (["anual", "annual"].includes(period.toLowerCase())) return `${cycle}/12`;
  if (["mensal", "monthly"].includes(period.toLowerCase())) return `Ciclo ${cycle}`;
  return `Ciclo ${cycle}`;
}
/** Sale descriptions in RykaPay are free text; only the Clínica Ryka program can be an ownerless sale. */
export function isClinicaRykaSale(description: unknown): boolean {
  return typeof description === "string" && normalizeProduct(description).includes("clinica ryka");
}
/**
 * Old Stripe subscriptions returned inside the RykaPay answer. Returns null when the Stripe part is
 * unavailable or incomplete, so the caller treats the whole read as partial and never as "paid".
 */
export function normalizeStripeLegacy(rawStripe: unknown): PaySubscription[] | null {
  const stripe = record(rawStripe);
  if (stripe.disponivel !== true || stripe.completo !== true || !Array.isArray(stripe.assinaturas) || !Array.isArray(stripe.cobrancas)) return null;
  const active = stripe.assinaturas.map(record).filter(a => typeof a.status === "string" && activePaySubscription(a.status));
  if (!active.length) return [];
  const paid = stripe.cobrancas.map(record)
    .filter(c => c.situacao === "aprovado" && c.contestado !== true && c.reembolsado_centavos === 0)
    .map(c => ({ id: text(c.id), amountCents: integer(c.bruto_centavos), paidAt: date(c.criada_em) }))
    .sort((a, b) => String(a.paidAt).localeCompare(String(b.paidAt)));
  if (paid.some(c => !c.id || !c.paidAt)) return null;
  const first = active[0];
  const id = text(first.id);
  if (!id) return null;
  return [{
    id,
    productId: null,
    productName: "Programa Clínica Ryka (Stripe)",
    status: text(first.status) || "ativa",
    period: "mensal",
    source: "stripe_legacy",
    invoices: paid.map((c, i): PayInvoice => ({ id: c.id as string, cycle: i + 1, status: "aprovado", situation: "pago", amountCents: c.amountCents, dueDate: null, paidAt: c.paidAt })),
  }];
}
/** A sale from the RykaPay charges list that a manager linked to a deal; null unless it is still paid. */
export function normalizeLinkedSale(raw: unknown): PaySubscription | null {
  const r = record(raw);
  const id = text(r.id);
  const name = text(r.descricao);
  if (!id || !name || r.status !== "paga" || !Array.isArray(r.parcelas)) return null;
  const invoices = r.parcelas.map((v): PayInvoice | null => {
    const f = record(v);
    const fid = text(f.id);
    const status = text(f.status) || "Não informado";
    if (!fid) return null;
    return {
      id: fid,
      cycle: integer(f.numero_parcela),
      status,
      situation: status === "recebido" ? "pago" : ["estornado", "cancelado", "chargeback"].includes(status) ? "cancelado" : "pendente",
      amountCents: integer(f.valor_bruto_centavos),
      dueDate: date(f.vencimento),
      paidAt: date(f.recebimento),
    };
  });
  if (invoices.some(f => !f)) return null;
  return {
    id,
    productId: null,
    productName: name,
    status: "paga",
    period: /mensal|ciclo/.test(normalizeProduct(name)) ? "mensal" : "anual",
    source: "linked_sale",
    invoices: invoices as PayInvoice[],
  };
}
