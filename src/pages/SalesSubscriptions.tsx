import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, Lock, MonitorPlay, Package, RefreshCw, Repeat, TrendingUp, X, XCircle } from "lucide-react";
import { usePayPortfolio, useCanSeePayPortfolio } from "@/hooks/usePayPortfolio";
import { PERIOD_LABELS, formatBRL, formatPercent, monthLabel, monthLongLabel, payDay, periodFor, portfolioMetrics, type PeriodKey } from "@/lib/sales/payPortfolio";
import { ChartCard, IndicatorCard, MiniTable, SectionHeader } from "@/components/sales/subscriptions/PortfolioParts";
import { PortfolioUnmatched } from "@/components/sales/subscriptions/PortfolioUnmatched";
import { PayLinkRequestsPanel } from "@/pages/PayLinkRequests";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CashflowChart, CashflowLegend, CountBars, HealthDonut, MrrChart, RankingBars } from "@/components/sales/subscriptions/PortfolioCharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const PERIODS: PeriodKey[] = ["all", "month", "3m", "12m"];
const dayBR = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

export default function SalesSubscriptions() {
  const [params, setParams] = useSearchParams();
  const tv = params.get("tv") === "1";
  const tab = params.get("aba") === "pagamentos" ? "pagamentos" : "painel";
  const setTab = (value: string) => setParams(prev => { const next = new URLSearchParams(prev); if (value === "pagamentos") next.set("aba", "pagamentos"); else next.delete("aba"); return next; }, { replace: true });
  const [periodKey, setPeriodKey] = useState<PeriodKey>("12m");
  const access = useCanSeePayPortfolio();
  const query = usePayPortfolio(access.data === true, tv);
  const today = payDay(new Date().toISOString()) as string;
  const metrics = useMemo(
    () => (query.data ? portfolioMetrics(query.data, today, periodFor(periodKey, today)) : null),
    [query.data, today, periodKey],
  );
  const setTv = (on: boolean) => setParams(prev => { const next = new URLSearchParams(prev); if (on) next.set("tv", "1"); else next.delete("tv"); return next; }, { replace: true });
  useEffect(() => {
    if (!tv) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTv(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tv]);

  const unmatched = useMemo(() => (query.data?.clinics ?? []).filter(c => !c.contracts.length), [query.data]);
  const updated = query.data ? `Atualizado ${formatDistanceToNow(new Date(query.data.generatedAt), { addSuffix: true, locale: ptBR })}` : null;
  const notices = query.data && metrics ? (
    <>
      {query.data.partial && (
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          O RykaPay não respondeu tudo nesta leitura. Os números podem estar abaixo do real; atualize em instantes.
        </p>
      )}
      {query.isError && (
        <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
          Não deu para atualizar agora. Mostrando a última leitura ({updated?.toLowerCase()}).
        </p>
      )}
    </>
  ) : null;

  if (access.isLoading) return <div className="space-y-4 p-4 md:p-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-28 w-full" /></div>;
  if (access.data !== true) {
    return (
      <div className="p-4 md:p-6">
        <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Lock className="h-5 w-5 shrink-0" strokeWidth={1.5} /> O painel de assinaturas mostra a receita de toda a carteira e fica disponível só para a gestão. Peça a liberação a um gestor.
        </CardContent></Card>
      </div>
    );
  }

  if (tv) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col gap-4 overflow-hidden bg-background p-6" data-testid="subscriptions-tv">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Assinaturas <span className="font-normal text-muted-foreground">· Clínica Ryka</span></h1>
          <div className="flex items-center gap-3 text-base text-muted-foreground">
            {query.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
            {updated}
            <Button variant="ghost" size="icon" className="h-11 w-11 opacity-40 hover:opacity-100" onClick={() => setTv(false)} aria-label="Sair do Modo TV"><X className="h-5 w-5" /></Button>
          </div>
        </div>
        {!metrics ? (
          <div className="flex flex-1 items-center justify-center text-xl text-muted-foreground">
            {query.isError ? (query.error as Error).message : "Lendo as assinaturas no RykaPay…"}
          </div>
        ) : (
          <>
            {notices}
            <div className="grid grid-cols-4 gap-4">
              <IndicatorCard tv label="MRR Consolidado" value={formatBRL(metrics.mrrCents)} description="Anual + mensal" icon={Repeat} />
              <IndicatorCard tv label="Clínicas Ativas" value={metrics.activeClinics} icon={CheckCircle2} />
              <IndicatorCard tv label="ARR · Anuais" value={formatBRL(metrics.annual.arrCents)} description="Valor anual dos contratos" icon={TrendingUp} />
              <IndicatorCard tv label="MRR · Mensais" value={formatBRL(metrics.monthly.mrrCents)} description="Assinaturas mensais" icon={CalendarDays} />
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
              <ChartCard tv title="Evolução de receita (MRR)" subtitle="Soma das mensalidades das clínicas ativas em cada competência" chart={<MrrChart tv data={metrics.mrrSeries} />} />
              <ChartCard tv title="Clínicas ativas" subtitle="Novas ativações por mês" headline={metrics.activeClinics} chart={<CountBars tv data={metrics.activations} />} />
            </div>
            <ChartCard tv className="min-h-0 flex-1" title="Fluxo de caixa por competência"
              subtitle={`Realizado e projeção das parcelas já contratadas · previsto a partir de ${monthLongLabel(metrics.projectionFrom)}`}
              headline={<CashflowLegend tv />} chart={<CashflowChart tv data={metrics.cashflow} />} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Repeat className="h-5 w-5" strokeWidth={1.5} /> Assinaturas</h1>
          <p className="text-sm text-muted-foreground">Receita recorrente do Programa Clínica Ryka.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {updated && <span className="text-[11px] text-muted-foreground/70" data-testid="portfolio-updated">{updated}</span>}
          {tab === "painel" && <Select value={periodKey} onValueChange={v => setPeriodKey(v as PeriodKey)}>
            <SelectTrigger className="h-11 w-44 sm:h-9" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map(p => <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>)}</SelectContent>
          </Select>}
          <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.5} />} Atualizar
          </Button>
          {tab === "painel" && <Button variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => setTv(true)}><MonitorPlay className="h-4 w-4" strokeWidth={1.5} /> Modo TV</Button>}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="painel" className="min-h-9">Painel</TabsTrigger>
          <TabsTrigger value="pagamentos" className="min-h-9">Pagamentos sem dono{unmatched.length > 0 ? ` (${unmatched.length})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      {!metrics && query.isLoading && (
        <div className="space-y-4" aria-busy="true">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo as assinaturas no RykaPay. Pode levar até um minuto.</p>
          <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          <Skeleton className="h-64" />
        </div>
      )}
      {!metrics && query.isError && (
        <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" strokeWidth={1.5} /> {(query.error as Error).message}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Tentar de novo</Button>
        </CardContent></Card>
      )}

      {tab === "pagamentos" && query.data && (
        <div className="max-w-4xl space-y-4">
          {notices}
          <PortfolioUnmatched clinics={unmatched} onLinked={() => void query.refetch()} />
          <PayLinkRequestsPanel embedded />
        </div>
      )}
      {tab === "pagamentos" && !query.data && !query.isLoading && <div className="max-w-4xl"><PayLinkRequestsPanel embedded /></div>}

      {tab === "painel" && metrics && query.data && (
        <>
          {notices}
          {metrics.notFound > 0 && (
            <p className="text-xs text-muted-foreground">
              {metrics.notFound} {metrics.notFound === 1 ? "negócio ganho de CR não foi localizado" : "negócios ganhos de CR não foram localizados"} no RykaPay e não {metrics.notFound === 1 ? "entra" : "entram"} nos números.{" "}
              <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => setTab("pagamentos")}>Ver quem {metrics.notFound === 1 ? "é" : "são"}</button>
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <IndicatorCard label="MRR Consolidado" value={formatBRL(metrics.mrrCents)} description="Anual + mensal, receita recorrente mensal total" icon={Repeat} />
            <IndicatorCard label="Clínicas Ativas" value={metrics.activeClinics} icon={CheckCircle2} />
          </div>

          <SectionHeader icon={Package} title="Contratos anuais" />
          <div className="grid gap-4 md:grid-cols-2">
            <IndicatorCard label="MRR" value={formatBRL(metrics.annual.mrrCents)} description="Receita recorrente mensal (ARR ÷ 12)" icon={Repeat} />
            <IndicatorCard label="ARR" value={formatBRL(metrics.annual.arrCents)} description="Valor anual do contrato" icon={TrendingUp} />
          </div>

          <SectionHeader icon={CalendarDays} title="Assinaturas mensais" />
          <div className="grid gap-4 md:grid-cols-2">
            <IndicatorCard label="MRR" value={formatBRL(metrics.monthly.mrrCents)} description="Receita recorrente mensal (ARR ÷ 12)" icon={Repeat} />
            <IndicatorCard label="ARR" value={formatBRL(metrics.monthly.arrCents)} description="Valor anual do contrato" icon={TrendingUp} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Evolução de receita (MRR)" subtitle="Soma das mensalidades das clínicas ativas em cada competência"
              chart={<MrrChart data={metrics.mrrSeries} />}
              table={<MiniTable head={["Mês", "MRR"]} rows={metrics.mrrSeries.map(r => [`${monthLabel(r.month)}/${r.month.slice(2, 4)}`, formatBRL(r.mrrCents)])} />} />
            <ChartCard title="Clínicas ativas" subtitle="Novas ativações por mês" headline={metrics.activeClinics}
              chart={<CountBars data={metrics.activations} />}
              table={<MiniTable head={["Mês", "Novas ativações"]} rows={metrics.activations.map(r => [`${monthLabel(r.month)}/${r.month.slice(2, 4)}`, r.count])} />} />
          </div>

          <ChartCard title="Fluxo de caixa por competência" subtitle="Realizado e projeção das parcelas já contratadas"
            headline={<div className="flex flex-wrap items-center justify-between gap-2 text-xs font-normal"><CashflowLegend /><span className="text-muted-foreground">previsto a partir de {monthLongLabel(metrics.projectionFrom)}</span></div>}
            chart={<CashflowChart data={metrics.cashflow} />}
            table={<MiniTable head={["Mês", "Recebido", "A receber"]} rows={metrics.cashflow.map(r => [`${monthLabel(r.month)}/${r.month.slice(2, 4)}${r.projected ? " (previsto)" : ""}`, formatBRL(r.receivedCents), formatBRL(r.receivableCents)])} />} />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Ranking de membros" subtitle="Top 8 por receita gerada no período"
              chart={<RankingBars data={metrics.ranking} />}
              table={<MiniTable head={["Membro", "Receita", "Clínicas ativas"]} rows={metrics.ranking.map(r => [r.seller, formatBRL(r.receivedCents), r.activeClinics])} />}
              footer={metrics.ranking.length > 0 && (
                <ul className="grid gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground sm:grid-cols-2">
                  {metrics.ranking.map(r => <li key={r.seller} className="flex justify-between gap-2"><span className="truncate">{r.seller}</span><span className="shrink-0 tabular-nums">{r.activeClinics} {r.activeClinics === 1 ? "clínica ativa" : "clínicas ativas"}</span></li>)}
                </ul>
              )} />
            <ChartCard title="Saúde da carteira" subtitle="Adimplência da carteira ativa"
              chart={
                <div className="flex flex-wrap items-center gap-6">
                  <HealthDonut rate={metrics.health.rate} />
                  <dl className="min-w-0 flex-1 space-y-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Clínicas adimplentes</dt><dd className="text-xl font-bold tabular-nums">{metrics.health.upToDate} de {metrics.health.activeClinics}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Em atraso</dt><dd className="text-xl font-bold tabular-nums">{metrics.cancellations.atRisk}</dd></div>
                  </dl>
                </div>
              } />
          </div>

          <SectionHeader icon={XCircle} title="Cancelamentos" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <IndicatorCard label="Cancelamentos no período" value={metrics.cancellations.inPeriod} description={`${metrics.cancellations.total} no histórico`} icon={XCircle} />
            <IndicatorCard label="MRR perdido" tone={metrics.cancellations.lostMrrCents > 0 ? "loss" : undefined} value={formatBRL(metrics.cancellations.lostMrrCents)} description={`${formatBRL(metrics.cancellations.lostMrrCents * 12)} por ano`} icon={TrendingUp} />
            <IndicatorCard label="Churn do período" value={formatPercent(metrics.cancellations.churn)} description={`Retenção de ${formatPercent(metrics.cancellations.retention)}`} icon={Repeat} />
            <IndicatorCard label="Em risco (atraso)" value={metrics.cancellations.atRisk} description={`${formatBRL(metrics.cancellations.atRiskMrrCents)} de MRR em risco`} icon={AlertTriangle} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Cancelamentos por mês" subtitle="Quantidade de clínicas que saíram em cada competência"
              chart={<CountBars tone="loss" data={metrics.cancellations.byMonth} />}
              table={<MiniTable head={["Mês", "Cancelamentos"]} rows={metrics.cancellations.byMonth.map(r => [`${monthLabel(r.month)}/${r.month.slice(2, 4)}`, r.count])} />} />
            <ChartCard title="Clínicas canceladas" subtitle="Saídas do período, com o membro responsável pela venda"
              chart={metrics.cancellations.list.length === 0
                ? <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Nenhuma clínica saiu neste período.</div>
                : (
                  <ul className="max-h-72 divide-y overflow-y-auto">
                    {metrics.cancellations.list.map(row => (
                      <li key={row.dealId} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{row.clinic}</p>
                          <p className="truncate text-xs text-muted-foreground">{[dayBR(row.date), "Cancelamento", row.kind, row.seller || "Sem vendedor"].join(" · ")}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-destructive">−{formatBRL(row.lostMrrCents)}</p>
                          <p className="text-xs text-muted-foreground">{formatBRL(row.receivedCents)} recebidos</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )} />
          </div>
        </>
      )}
    </div>
  );
}
