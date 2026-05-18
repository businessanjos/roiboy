import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  LineChart as LineChartIcon,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRL, formatBRLCompact, formatAxisBRL } from "@/lib/financial-format";
import { toast } from "sonner";

type ViewMode = "all" | "realized" | "forecast";

export default function FinancialCashFlowPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<ViewMode>("all");

  const startDate = startOfMonth(currentMonth);
  const endDate = endOfMonth(currentMonth);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cash-flow-entries", accountId, format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("account_id", accountId)
        .gte("due_date", format(startDate, "yyyy-MM-dd"))
        .lte("due_date", format(endDate, "yyyy-MM-dd"))
        .order("due_date");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("current_balance")
        .eq("account_id", accountId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  const initialBalance = bankAccounts.reduce((acc, b) => acc + b.current_balance, 0);

  const isRealized = (s: string) => s === "paid";
  const isForecast = (s: string) => s === "pending" || s === "overdue";

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    let runningBalance = initialBalance;
    return days.map((day) => {
      const dayEntries = entries.filter((e) => isSameDay(parseISO(e.due_date), day));
      const incomePaid = dayEntries
        .filter((e) => e.entry_type === "receivable" && isRealized(e.status))
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const incomeForecast = dayEntries
        .filter((e) => e.entry_type === "receivable" && isForecast(e.status))
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const expensesPaid = dayEntries
        .filter((e) => e.entry_type === "payable" && isRealized(e.status))
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const expensesForecast = dayEntries
        .filter((e) => e.entry_type === "payable" && isForecast(e.status))
        .reduce((acc, e) => acc + Number(e.amount || 0), 0);

      // View mode filters what contributes to the running balance
      let income = 0;
      let expenses = 0;
      if (view === "realized") {
        income = incomePaid;
        expenses = expensesPaid;
      } else if (view === "forecast") {
        income = incomeForecast;
        expenses = expensesForecast;
      } else {
        income = incomePaid + incomeForecast;
        expenses = expensesPaid + expensesForecast;
      }
      runningBalance = runningBalance + income - expenses;

      return {
        date: format(day, "dd"),
        fullDate: format(day, "dd/MM", { locale: ptBR }),
        income,
        expenses,
        incomePaid,
        incomeForecast,
        expensesPaid,
        expensesForecast,
        balance: runningBalance,
        net: income - expenses,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, startDate, endDate, initialBalance, view]);

  // Totals respect the view mode
  const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
  const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0);
  const paidIncome = chartData.reduce((s, d) => s + d.incomePaid, 0);
  const paidExpenses = chartData.reduce((s, d) => s + d.expensesPaid, 0);
  const netResult = totalIncome - totalExpenses;
  const finalBalance = chartData[chartData.length - 1]?.balance || 0;

  const handleExportCsv = () => {
    if (!entries.length) {
      toast.info("Não há lançamentos no período para exportar.");
      return;
    }
    const header = ["Data", "Dia", "Receita do dia", "Despesa do dia", "Saldo do dia", "Saldo acumulado"];
    const rows = chartData.map((d) => [
      d.fullDate,
      d.date,
      d.income.toFixed(2).replace(".", ","),
      d.expenses.toFixed(2).replace(".", ","),
      d.net.toFixed(2).replace(".", ","),
      d.balance.toFixed(2).replace(".", ","),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fluxo-caixa-${format(currentMonth, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  const viewHint =
    view === "realized"
      ? "Somente lançamentos pagos/recebidos"
      : view === "forecast"
      ? "Somente lançamentos pendentes (previsão)"
      : "Realizado + previsto";

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={LineChartIcon}
        title="Fluxo de Caixa"
        description="Acompanhe entradas, saídas e projeção do período selecionado."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1.5">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <div className="flex items-center gap-1 rounded-lg border bg-card px-1 py-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))
                }
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))
                }
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="all">Tudo</TabsTrigger>
            <TabsTrigger value="realized">Realizado</TabsTrigger>
            <TabsTrigger value="forecast">Previsto</TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground">{viewHint}</p>
        </div>

        <TabsContent value={view} className="mt-4 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FinancialKpiCard
              icon={TrendingUp}
              label="Receitas"
              value={formatBRLCompact(totalIncome)}
              hint={view !== "forecast" ? `${formatBRLCompact(paidIncome)} já recebido` : "Apenas previsão"}
              tone="success"
              loading={isLoading}
            />
            <FinancialKpiCard
              icon={TrendingDown}
              label="Despesas"
              value={formatBRLCompact(totalExpenses)}
              hint={view !== "forecast" ? `${formatBRLCompact(paidExpenses)} já pago` : "Apenas previsão"}
              tone="danger"
              loading={isLoading}
            />
            <FinancialKpiCard
              icon={netResult >= 0 ? TrendingUp : TrendingDown}
              label="Resultado do mês"
              value={formatBRLCompact(netResult)}
              hint="Receitas − despesas"
              tone={netResult >= 0 ? "success" : "danger"}
              loading={isLoading}
            />
            <FinancialKpiCard
              icon={Wallet}
              label="Saldo projetado"
              value={formatBRLCompact(finalBalance)}
              hint="Estimativa para o fim do mês"
              tone={finalBalance >= 0 ? "info" : "danger"}
              loading={isLoading}
            />
          </div>

          {/* Balance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do saldo</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatAxisBRL(v)} tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{d.fullDate}</p>
                              <p className="text-sm text-muted-foreground">
                                Saldo:{" "}
                                <span
                                  className={
                                    d.balance >= 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-red-600 dark:text-red-400"
                                  }
                                >
                                  {formatBRL(d.balance)}
                                </span>
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="hsl(var(--primary))"
                        fill="url(#balanceGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income vs Expenses Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receitas vs Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatAxisBRL(v)} tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-lg space-y-0.5">
                              <p className="font-medium">{d.fullDate}</p>
                              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                Receitas: {formatBRL(d.income)}
                              </p>
                              <p className="text-sm text-red-600 dark:text-red-400">
                                Despesas: {formatBRL(d.expenses)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {(view === "all" || view === "realized") && (
                        <Bar
                          dataKey="incomePaid"
                          stackId="in"
                          fill="hsl(142 71% 45%)"
                          name="Receitas (recebido)"
                          radius={[3, 3, 0, 0]}
                        />
                      )}
                      {(view === "all" || view === "forecast") && (
                        <Bar
                          dataKey="incomeForecast"
                          stackId="in"
                          fill="hsl(142 71% 75%)"
                          name="Receitas (previsto)"
                          fillOpacity={0.7}
                          radius={view === "forecast" ? [3, 3, 0, 0] : undefined}
                        />
                      )}
                      {(view === "all" || view === "realized") && (
                        <Bar
                          dataKey="expensesPaid"
                          stackId="out"
                          fill="hsl(0 70% 55%)"
                          name="Despesas (pago)"
                          radius={[3, 3, 0, 0]}
                        />
                      )}
                      {(view === "all" || view === "forecast") && (
                        <Bar
                          dataKey="expensesForecast"
                          stackId="out"
                          fill="hsl(0 70% 80%)"
                          name="Despesas (previsto)"
                          fillOpacity={0.7}
                          radius={view === "forecast" ? [3, 3, 0, 0] : undefined}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
