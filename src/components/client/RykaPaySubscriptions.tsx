import { useState } from "react";
import { RefreshCw, Loader2, CreditCard, CircleCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRykaPaySubscriptions } from "@/hooks/useRykaPaySubscriptions";
import { payMetrics, payCycleLabel, type PaySubscription } from "@/lib/rykaPay";
import { orderPayInvoices } from "@/lib/sales/payInvoiceOrder";

const money = (cents: number | null) => cents === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
function day(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
const periods: Record<string, string> = { mensal: "Mensal", monthly: "Mensal", anual: "Anual", annual: "Anual" };
const situations: Record<string, string> = { pago: "Pago", pendente: "Não pago", vencido: "Não pago · em atraso", cancelado: "Cancelado", outro: "Não informado" };

export function RykaPaySubscriptions(target: { dealId?: string; clientId?: string }) {
  const query = useRykaPaySubscriptions(target);
  const [selected, setSelected] = useState("all");
  const data = query.data;
  const subscriptions = data?.subscriptions ?? [];
  const selectionExists = subscriptions.some(s => s.id === selected);
  const visible = selected === "all" || !selectionExists ? subscriptions : subscriptions.filter(s => s.id === selected);
  const metrics = payMetrics(visible, Boolean(data?.partial));
  const emptyText = data?.state === "needs_document" ? "Cadastre o CPF, CNPJ ou e-mail para consultar a assinatura."
    : data?.state === "needs_product" ? "Selecione o Item da Venda para consultar a assinatura do produto."
    : data?.payerFound === false ? "Cliente não encontrado no RykaPay com o CPF, CNPJ ou e-mail cadastrados no ROY."
    : data?.productName ? `Nenhuma assinatura ativa correspondente a ${data.productName} no RykaPay.`
    : "Nenhuma assinatura ativa encontrada no RykaPay para este CPF/CNPJ ou e-mail.";

  return <section className="min-w-0 space-y-4" aria-label="Assinaturas RykaPay">
    <header className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Assinaturas <span className="font-normal text-muted-foreground">· RykaPay</span></h3>
      </div>
      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Atualizar assinaturas" title="Atualizar assinaturas" disabled={query.isFetching} onClick={() => void query.refetch()}>
        <RefreshCw className={query.isFetching ? "h-4 w-4 motion-safe:animate-spin" : "h-4 w-4"} />
      </Button>
    </header>
    {query.isPending && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 motion-safe:animate-spin" />Consultando assinaturas…</p>}
    {query.isError && <div role="alert" className="flex gap-2 border-l-2 border-destructive pl-3 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
      <div><p>{query.error.message}</p>{data && <p className="mt-1 text-muted-foreground">Última consulta exibida; os pagamentos podem estar desatualizados.</p>}</div>
    </div>}
    {data && <>
      {data.partial && <p role="status" className="border-l-2 border-warning pl-3 text-sm text-muted-foreground">Consulta parcial no RykaPay. Totais indisponíveis.</p>}
      {data.matchedBy === "email" && subscriptions.length > 0 && <p role="status" className="border-l-2 border-border pl-3 text-sm text-muted-foreground">Vinculada pelo e-mail: o CPF/CNPJ do ROY não foi encontrado no RykaPay.</p>}
      {!subscriptions.length ? <div className="space-y-3 py-6 text-sm text-muted-foreground">
        <p>{emptyText}</p>
        {Boolean(data.skipped?.length) && <div className="space-y-1">
          <p>O RykaPay tem estes registros do cliente, que não entram aqui por serem de outro produto ou não estarem ativos:</p>
          <ul className="list-disc space-y-0.5 pl-5">{data.skipped!.map((item, i) => <li key={i} className="break-words">{item.productName} · {item.kind === "charge" ? "cobrança avulsa" : "assinatura"} · {item.status}</li>)}</ul>
        </div>}
      </div> : <>
        {target.clientId && subscriptions.length > 1 && <Select value={selectionExists ? selected : "all"} onValueChange={setSelected}>
          <SelectTrigger className="h-11 min-w-0 text-base sm:text-sm" aria-label="Filtrar assinatura"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as assinaturas</SelectItem>{subscriptions.map((s, i) => <SelectItem key={s.id} value={s.id}>{s.productName} · {periods[s.period] || s.period} · {i + 1}</SelectItem>)}</SelectContent>
        </Select>}
        <div className="grid grid-cols-2 gap-3 border-y border-border py-4">
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Total já recebido</p><p className="mt-1 break-words text-lg font-semibold tabular-nums">{money(metrics.paidCents)}</p></div>
          <div className="min-w-0"><p className="text-xs text-muted-foreground">Faturas a vencer</p><p className="mt-1 text-lg font-semibold tabular-nums">{metrics.upcoming ?? "—"}</p></div>
        </div>
        {visible.map(s => <SubscriptionHistory key={s.id} subscription={s} />)}
      </>}
      <p className="text-xs text-muted-foreground">Consultado em {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
    </>}
  </section>;
}

function SubscriptionHistory({ subscription: s }: { subscription: PaySubscription }) {
  const annual = s.source === "annual_sale" || periods[s.period] === "Anual";
  const invoices = orderPayInvoices(s.invoices, annual);
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="outline" className="max-w-full whitespace-normal break-words text-xs font-medium" style={{ backgroundColor: `${s.royProductColor || "#6b7280"}20`, borderColor: s.royProductColor || "#6b7280", color: s.royProductColor || "#6b7280" }}>{s.productName}</Badge><Badge variant="outline" className="max-w-full break-words">{s.status}</Badge></div>
    {s.source === "annual_sale" && <p className="text-xs text-muted-foreground">Plano anual · cobrança do RykaPay</p>}
    <p className="text-xs font-medium text-muted-foreground">Histórico de pagamentos</p>
    {!invoices.length ? <p className="text-sm text-muted-foreground">Nenhuma fatura disponível para esta assinatura.</p> : <ol className="divide-y divide-border">
      {invoices.map(f => <li key={f.id} className="space-y-2 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">{money(f.amountCents)}</span>
          <Badge variant="outline" className={f.situation === "pago" ? "gap-1 border-success/30 bg-success/10 text-success" : f.situation === "vencido" ? "border-destructive/30 bg-destructive/10 text-destructive" : "text-muted-foreground"}>
            {f.situation === "pago" && <CircleCheck className="h-3 w-3" />}{situations[f.situation] || "Não informado"}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div><dt className="text-muted-foreground">Ciclo · periodicidade</dt><dd className="mt-0.5">{payCycleLabel(s.period, f.cycle)} · {periods[s.period] || s.period}</dd></div>
          <div><dt className="text-muted-foreground">Vencimento</dt><dd className="mt-0.5 tabular-nums">{day(f.dueDate)}</dd></div>
          <div><dt className="text-muted-foreground">Status</dt><dd className="mt-0.5 break-words">{f.status}</dd></div>
          <div><dt className="text-muted-foreground">Pagamento</dt><dd className="mt-0.5 tabular-nums">{f.situation === "pago" ? day(f.paidAt) : "—"}</dd></div>
        </dl>
      </li>)}
    </ol>}
  </div>;
}