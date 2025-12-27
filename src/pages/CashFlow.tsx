import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3
} from "lucide-react";
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, addWeeks, addMonths, isWithinInterval, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ComposedChart, Line } from "recharts";

type Period = "daily" | "weekly" | "monthly";
type Horizon = "30" | "60" | "90";

export default function CashFlow() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  const [period, setPeriod] = useState<Period>("daily");
  const [horizon, setHorizon] = useState<Horizon>("30");
  const [selectedBankId, setSelectedBankId] = useState<string>("all");

  // Fetch bank accounts
  const { data: bankAccounts, isLoading: loadingBanks } = useQuery({
    queryKey: ["bank-accounts-cashflow", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("account_id", accountId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch financial entries (pending and upcoming)
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ["financial-entries-cashflow", accountId, horizon],
    queryFn: async () => {
      const today = new Date();
      const endDate = addDays(today, parseInt(horizon));
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, bank_accounts(name, color), financial_categories(name, color)")
        .eq("account_id", accountId!)
        .in("status", ["pending", "scheduled"])
        .gte("due_date", format(today, "yyyy-MM-dd"))
        .lte("due_date", format(endDate, "yyyy-MM-dd"))
        .order("due_date");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Calculate projections
  const projectionData = useMemo(() => {
    if (!entries || !bankAccounts) return [];

    const today = startOfDay(new Date());
    const endDate = addDays(today, parseInt(horizon));
    
    // Get initial balances
    const initialBalance = selectedBankId === "all"
      ? bankAccounts.reduce((sum, b) => sum + (b.current_balance || 0), 0)
      : bankAccounts.find(b => b.id === selectedBankId)?.current_balance || 0;

    // Filter entries by bank if needed
    const filteredEntries = selectedBankId === "all"
      ? entries
      : entries.filter(e => e.bank_account_id === selectedBankId);

    // Generate periods
    let periods: { start: Date; end: Date; label: string }[] = [];
    
    if (period === "daily") {
      const days = eachDayOfInterval({ start: today, end: endDate });
      periods = days.map(day => ({
        start: startOfDay(day),
        end: endOfDay(day),
        label: format(day, "dd/MM", { locale: ptBR })
      }));
    } else if (period === "weekly") {
      const weeks = eachWeekOfInterval({ start: today, end: endDate }, { weekStartsOn: 1 });
      periods = weeks.map(week => ({
        start: startOfWeek(week, { weekStartsOn: 1 }),
        end: endOfWeek(week, { weekStartsOn: 1 }),
        label: `Sem ${format(week, "dd/MM", { locale: ptBR })}`
      }));
    } else {
      const months = eachMonthOfInterval({ start: today, end: endDate });
      periods = months.map(month => ({
        start: startOfMonth(month),
        end: endOfMonth(month),
        label: format(month, "MMM/yy", { locale: ptBR })
      }));
    }

    // Calculate values for each period
    let runningBalance = initialBalance;
    
    return periods.map(p => {
      const periodEntries = filteredEntries.filter(e => {
        const dueDate = new Date(e.due_date);
        return isWithinInterval(dueDate, { start: p.start, end: p.end });
      });

      const receivables = periodEntries
        .filter(e => e.entry_type === "receivable")
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const payables = periodEntries
        .filter(e => e.entry_type === "payable")
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const netFlow = receivables - payables;
      runningBalance += netFlow;

      return {
        period: p.label,
        receivables,
        payables,
        netFlow,
        projectedBalance: runningBalance,
        entries: periodEntries.length
      };
    });
  }, [entries, bankAccounts, period, horizon, selectedBankId]);

  // Summary calculations
  const summary = useMemo(() => {
    if (!projectionData.length) return null;

    const totalReceivables = projectionData.reduce((sum, p) => sum + p.receivables, 0);
    const totalPayables = projectionData.reduce((sum, p) => sum + p.payables, 0);
    const netFlow = totalReceivables - totalPayables;
    const finalBalance = projectionData[projectionData.length - 1]?.projectedBalance || 0;
    const initialBalance = (projectionData[0]?.projectedBalance || 0) - (projectionData[0]?.netFlow || 0);
    const lowestBalance = Math.min(...projectionData.map(p => p.projectedBalance));

    return {
      totalReceivables,
      totalPayables,
      netFlow,
      finalBalance,
      initialBalance,
      lowestBalance,
      isPositive: netFlow >= 0
    };
  }, [projectionData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const isLoading = loadingBanks || loadingEntries;

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
            <p className="text-muted-foreground">
              Projeção de recebimentos e pagamentos
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {bankAccounts?.map(bank => (
                  <SelectItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={horizon} onValueChange={(v) => setHorizon(v as Horizon)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        ) : summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalReceivables)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Próximos {horizon} dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalPayables)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Próximos {horizon} dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fluxo Líquido</CardTitle>
                {summary.isPositive ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summary.isPositive ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(summary.netFlow)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Receitas - Despesas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Projetado</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${summary.finalBalance >= 0 ? "text-foreground" : "text-red-600"}`}>
                  {formatCurrency(summary.finalBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Em {format(addDays(new Date(), parseInt(horizon)), "dd/MM/yyyy")}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alert for low balance */}
        {summary && summary.lowestBalance < 0 && (
          <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-600">
                  Atenção: Saldo negativo projetado de {formatCurrency(summary.lowestBalance)} no período
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <Tabs defaultValue="area" className="space-y-4">
          <TabsList>
            <TabsTrigger value="area">Saldo Projetado</TabsTrigger>
            <TabsTrigger value="bars">Entradas x Saídas</TabsTrigger>
            <TabsTrigger value="combined">Combinado</TabsTrigger>
          </TabsList>

          <TabsContent value="area">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Evolução do Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={projectionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="period" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value)}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        width={100}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="projectedBalance"
                        name="Saldo Projetado"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bars">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Recebimentos vs Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={projectionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="period" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => formatCurrency(value)}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        width={100}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="receivables" 
                        name="A Receber" 
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        dataKey="payables" 
                        name="A Pagar" 
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combined">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Visão Combinada
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={projectionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="period" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        yAxisId="left"
                        tickFormatter={(value) => formatCurrency(value)}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        width={100}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(value) => formatCurrency(value)}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        width={100}
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar 
                        yAxisId="left"
                        dataKey="receivables" 
                        name="A Receber" 
                        fill="#22c55e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="payables" 
                        name="A Pagar" 
                        fill="#ef4444"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="projectedBalance" 
                        name="Saldo Projetado"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Details Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Detalhamento por Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left font-medium">Período</th>
                      <th className="py-3 px-4 text-right font-medium">A Receber</th>
                      <th className="py-3 px-4 text-right font-medium">A Pagar</th>
                      <th className="py-3 px-4 text-right font-medium">Fluxo Líquido</th>
                      <th className="py-3 px-4 text-right font-medium">Saldo Projetado</th>
                      <th className="py-3 px-4 text-center font-medium">Lançamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionData.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{row.period}</td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {formatCurrency(row.receivables)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {formatCurrency(row.payables)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${row.netFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(row.netFlow)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${row.projectedBalance >= 0 ? "" : "text-red-600"}`}>
                          {formatCurrency(row.projectedBalance)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="secondary">{row.entries}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </CardContent>
        </Card>
      </div>
  );
}
