import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-muted-foreground">Acompanhe entradas e saídas do período</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-medium min-w-[180px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(paidIncome)}</div>
            <p className="text-xs text-muted-foreground">de {formatCurrency(totalIncome)} previsto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(paidExpenses)}</div>
            <p className="text-xs text-muted-foreground">de {formatCurrency(totalExpenses)} previsto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resultado do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${paidIncome - paidExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(paidIncome - paidExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">receitas - despesas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Saldo Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${chartData[chartData.length - 1]?.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(chartData[chartData.length - 1]?.balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground">projeção fim do mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do Saldo</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCurrency(v).replace("R$", "")} className="text-xs" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.fullDate}</p>
                          <p className="text-sm text-muted-foreground">
                            Saldo: <span className={data.balance >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(data.balance)}</span>
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
          <CardTitle>Receitas vs Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis tickFormatter={(v) => formatCurrency(v).replace("R$", "")} className="text-xs" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.fullDate}</p>
                          <p className="text-sm text-green-600">Receitas: {formatCurrency(data.income)}</p>
                          <p className="text-sm text-red-600">Despesas: {formatCurrency(data.expenses)}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar dataKey="incomePaid" stackId="in" fill="#16a34a" name="Receitas (recebido)" />
                  <Bar dataKey="income" stackId="in" fill="#86efac" name="Receitas (previsto)" fillOpacity={0.6} />
                  <Bar dataKey="expensesPaid" stackId="out" fill="#dc2626" name="Despesas (pago)" />
                  <Bar dataKey="expenses" stackId="out" fill="#fca5a5" name="Despesas (previsto)" fillOpacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
