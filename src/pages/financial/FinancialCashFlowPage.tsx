import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, LineChart as LineChartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";
import { FinancialPageHeader, FinancialKpiCard } from "@/components/financial/_shared";
import { formatBRL, formatAxisBRL } from "@/lib/financial-format";

export default function FinancialCashFlowPage() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  // Generate daily cash flow data
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  let runningBalance = initialBalance;

  const isRealized = (s: string) => s === "paid";
  const isForecast = (s: string) => s === "pending" || s === "overdue";

  const chartData = days.map((day) => {
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

    const income = incomePaid + incomeForecast;
    const expenses = expensesPaid + expensesForecast;
    runningBalance = runningBalance + income - expenses;

    return {
      date: format(day, "dd"),
      fullDate: format(day, "dd/MM", { locale: ptBR }),
      income,
      expenses,
      incomePaid,
      expensesPaid,
      balance: runningBalance,
      net: income - expenses,
    };
  });

  // Calculate totals
  const totalIncome = entries
    .filter((e) => e.entry_type === "receivable" && e.status !== "cancelled")
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const paidIncome = entries
    .filter((e) => e.entry_type === "receivable" && isRealized(e.status))
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const totalExpenses = entries
    .filter((e) => e.entry_type === "payable" && e.status !== "cancelled")
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const paidExpenses = entries
    .filter((e) => e.entry_type === "payable" && isRealized(e.status))
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);

  const netResult = totalIncome - totalExpenses;
  const finalBalance = chartData[chartData.length - 1]?.balance || 0;

  return (
    <div className="p-6 space-y-6">
      <FinancialPageHeader
        icon={LineChartIcon}
        title="Fluxo de Caixa"
        description="Acompanhe entradas, saídas e projeção do período selecionado."
        actions={
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
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <FinancialKpiCard
          icon={TrendingUp}
          label="Receitas"
          value={formatBRL(totalIncome)}
          hint={`${formatBRL(paidIncome)} já recebido`}
          tone="success"
          loading={isLoading}
        />
        <FinancialKpiCard
          icon={TrendingDown}
          label="Despesas"
          value={formatBRL(totalExpenses)}
          hint={`${formatBRL(paidExpenses)} já pago`}
          tone="danger"
          loading={isLoading}
        />
        <FinancialKpiCard
          icon={netResult >= 0 ? TrendingUp : TrendingDown}
          label="Resultado do mês"
          value={formatBRL(netResult)}
          hint="Receitas − despesas (previsto)"
          tone={netResult >= 0 ? "success" : "danger"}
          loading={isLoading}
        />
        <FinancialKpiCard
          icon={Wallet}
          label="Saldo projetado"
          value={formatBRL(finalBalance)}
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
                  <YAxis
                    tickFormatter={(v) => formatAxisBRL(v)}
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
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
                  <YAxis
                    tickFormatter={(v) => formatAxisBRL(v)}
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
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
                  <Bar dataKey="incomePaid" stackId="in" fill="hsl(142 71% 45%)" name="Receitas (recebido)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="income" stackId="in" fill="hsl(142 71% 75%)" name="Receitas (previsto)" fillOpacity={0.7} />
                  <Bar dataKey="expensesPaid" stackId="out" fill="hsl(0 70% 55%)" name="Despesas (pago)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expenses" stackId="out" fill="hsl(0 70% 80%)" name="Despesas (previsto)" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
