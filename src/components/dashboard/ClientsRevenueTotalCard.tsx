import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { DollarSign, Info, TrendingDown, TrendingUp } from "lucide-react";
import type { DateRange } from "react-day-picker";

interface Props {
  accountId?: string;
  /** Client ids already filtered by the Gestão product filter (undefined = all clients). */
  clientIds?: string[];
  /** Total clients in the current scope (used to calculate missing revenue). */
  totalClients?: number;
  productLabel?: string;
  periodFilter: string;
  customRange?: DateRange;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (m: string) => {
  const [y, mm] = m.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(mm) - 1]}/${y.slice(2)}`;
};

function periodBounds(periodFilter: string, customRange?: DateRange): { from: string; to: string; label: string } {
  const now = new Date();
  const to = monthKey(now);
  switch (periodFilter) {
    case "7":
    case "month":
      return { from: to, to, label: "Este mês" };
    case "3":
    case "6":
    case "12": {
      const n = Number(periodFilter);
      const start = new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
      return { from: monthKey(start), to, label: `Últimos ${n} meses` };
    }
    case "custom": {
      if (customRange?.from) {
        const end = customRange.to ?? customRange.from;
        return { from: monthKey(customRange.from), to: monthKey(end), label: "Período personalizado" };
      }
      return { from: `${now.getFullYear()}-01`, to, label: "Este ano" };
    }
    default:
      return { from: `${now.getFullYear()}-01`, to, label: "Este ano" };
  }
}

export function ClientsRevenueTotalCard({ accountId, clientIds, totalClients, productLabel, periodFilter, customRange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-clients-revenue-history", accountId],
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_revenue_history")
        .select("client_id, month, revenue")
        .eq("account_id", accountId!)
        .order("month", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { client_id: string; month: string; revenue: number }[];
    },
  });

  const allowed = useMemo(() => (clientIds ? new Set(clientIds) : null), [clientIds]);

  const stats = useMemo(() => {
    const rows = (data ?? []).filter((r) => !allowed || allowed.has(r.client_id));
    const now = new Date();
    const year = String(now.getFullYear());
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const prevYear = String(now.getFullYear() - 1);
    const bounds = periodBounds(periodFilter, customRange);

    const byMonth = new Map<string, { total: number; clients: Set<string> }>();
    for (const r of rows) {
      const entry = byMonth.get(r.month) ?? { total: 0, clients: new Set<string>() };
      entry.total += Number(r.revenue) || 0;
      entry.clients.add(r.client_id);
      byMonth.set(r.month, entry);
    }

    const sum = (pred: (m: string) => boolean) =>
      Array.from(byMonth.entries()).reduce((acc, [m, v]) => (pred(m) ? acc + v.total : acc), 0);

    const yearTotal = sum((m) => m.startsWith(year));
    const prevYearTotal = sum((m) => m.startsWith(prevYear));
    const periodTotal = sum((m) => m >= bounds.from && m <= bounds.to);

    const lastMonthTotal = byMonth.get(lastMonth)?.total ?? 0;
    const thisMonthTotal = byMonth.get(thisMonth)?.total ?? 0;
    const monthBefore = monthKey(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    const monthBeforeTotal = byMonth.get(monthBefore)?.total ?? 0;
    const momDelta = monthBeforeTotal > 0 ? ((lastMonthTotal - monthBeforeTotal) / monthBeforeTotal) * 100 : null;
    const yoyDelta = prevYearTotal > 0 ? ((yearTotal - prevYearTotal) / prevYearTotal) * 100 : null;

    const chart = Array.from(byMonth.entries())
      .filter(([m]) => m >= bounds.from && m <= bounds.to)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({
        month: m,
        label: monthLabel(m),
        total: v.total,
        clients: v.clients.size,
        missing: totalClients != null ? Math.max(0, totalClients - v.clients.size) : null,
      }));

    const clientsWithData = new Set(rows.map((r) => r.client_id)).size;
    const missingClients = totalClients != null ? Math.max(0, totalClients - clientsWithData) : null;

    return {
      yearTotal,
      lastMonthTotal,
      lastMonthLabel: monthLabel(lastMonth),
      thisMonthTotal,
      thisMonthLabel: monthLabel(thisMonth),
      periodTotal,
      periodLabel: bounds.label,
      momDelta,
      yoyDelta,
      chart,
      clientsWithData,
      totalClients,
      missingClients,
      hasData: rows.length > 0,
    };
  }, [data, allowed, periodFilter, customRange, totalClients]);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Faturamento combinado dos clientes
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Soma do faturamento mensal informado por cada mentorado (histórico de faturamento). Respeita o filtro
                    de produto e período da aba Gestão.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <CardDescription>
              {productLabel ? `Produto: ${productLabel}` : "Todos os produtos"} · {stats.clientsWithData} de{" "}
              {stats.totalClients != null ? stats.totalClients : stats.clientsWithData} cliente(s) com faturamento
              informado
              {stats.missingClients != null && stats.missingClients > 0 && (
                <> · <span className="text-warning font-medium">{stats.missingClients} sem preenchimento</span></>
              )}
            </CardDescription>
          </div>
          <Badge variant="secondary">{stats.periodLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !stats.hasData ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum faturamento informado para os filtros selecionados.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground">Total no ano</p>
                <p className="text-2xl font-bold text-primary">{brl(stats.yearTotal)}</p>
                {stats.yoyDelta !== null && (
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      stats.yoyDelta >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {stats.yoyDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stats.yoyDelta.toFixed(1)}% vs ano anterior
                  </p>
                )}
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground">Último mês ({stats.lastMonthLabel})</p>
                <p className="text-2xl font-bold">{brl(stats.lastMonthTotal)}</p>
                {stats.momDelta !== null && (
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      stats.momDelta >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {stats.momDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stats.momDelta.toFixed(1)}% vs mês anterior
                  </p>
                )}
              </div>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-xs text-muted-foreground">Período filtrado ({stats.periodLabel})</p>
                <p className="text-2xl font-bold">{brl(stats.periodTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mês atual ({stats.thisMonthLabel}): {brl(stats.thisMonthTotal)}
                </p>
              </div>
            </div>

            {stats.chart.length > 0 && (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <RTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0]?.payload as {
                          month: string;
                          total: number;
                          clients: number;
                          missing: number | null;
                        };
                        return (
                          <div className="rounded-md border bg-popover px-3 py-2 shadow-md">
                            <p className="text-xs font-medium text-foreground mb-1">{label}</p>
                            <p className="text-sm font-semibold text-primary">{brl(p.total)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {p.clients} cliente(s) com faturamento
                            </p>
                            {p.missing != null && p.missing > 0 && (
                              <p className="text-xs text-warning mt-0.5">
                                {p.missing} cliente(s) sem faturamento preenchido
                              </p>
                            )}
                            {p.missing === 0 && (
                              <p className="text-xs text-success mt-0.5">Todos os clientes preenchidos</p>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
