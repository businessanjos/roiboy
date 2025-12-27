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
  BarChart3,
  AlertTriangle,
  Users,
  Clock,
  PieChart as PieChartIcon
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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

  // Fetch overdue entries
  const { data: overdueEntries, isLoading: loadingOverdue } = useQuery({
    queryKey: ["financial-entries-overdue", accountId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, bank_accounts(name, color), financial_categories(name, color), clients(full_name)")
        .eq("account_id", accountId!)
        .in("status", ["pending", "scheduled"])
        .lt("due_date", today)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Overdue summary
  const overdueSummary = useMemo(() => {
    if (!overdueEntries?.length) return null;

    const filteredOverdue = selectedBankId === "all"
      ? overdueEntries
      : overdueEntries.filter(e => e.bank_account_id === selectedBankId);

    const overdueReceivables = filteredOverdue
      .filter(e => e.entry_type === "receivable")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const overduePayables = filteredOverdue
      .filter(e => e.entry_type === "payable")
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const receivableCount = filteredOverdue.filter(e => e.entry_type === "receivable").length;
    const payableCount = filteredOverdue.filter(e => e.entry_type === "payable").length;

    return {
      receivables: overdueReceivables,
      payables: overduePayables,
      receivableCount,
      payableCount,
      total: overdueReceivables + overduePayables,
      entries: filteredOverdue
    };
  }, [overdueEntries, selectedBankId]);

  // Delinquency analysis (inadimplência) - focused on receivables
  const delinquencyAnalysis = useMemo(() => {
    if (!overdueEntries?.length) return null;

    const filteredOverdue = selectedBankId === "all"
      ? overdueEntries
      : overdueEntries.filter(e => e.bank_account_id === selectedBankId);

    const receivables = filteredOverdue.filter(e => e.entry_type === "receivable");
    if (!receivables.length) return null;

    const today = new Date();
    
    // Aging buckets
    const aging = {
      "1-15": { amount: 0, count: 0, entries: [] as typeof receivables },
      "16-30": { amount: 0, count: 0, entries: [] as typeof receivables },
      "31-60": { amount: 0, count: 0, entries: [] as typeof receivables },
      "60+": { amount: 0, count: 0, entries: [] as typeof receivables },
    };

    // Group by client
    const byClient: Record<string, { name: string; amount: number; count: number; oldestDays: number }> = {};

    receivables.forEach(entry => {
      const dueDate = new Date(entry.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = entry.amount || 0;

      // Aging bucket
      if (daysOverdue <= 15) {
        aging["1-15"].amount += amount;
        aging["1-15"].count++;
        aging["1-15"].entries.push(entry);
      } else if (daysOverdue <= 30) {
        aging["16-30"].amount += amount;
        aging["16-30"].count++;
        aging["16-30"].entries.push(entry);
      } else if (daysOverdue <= 60) {
        aging["31-60"].amount += amount;
        aging["31-60"].count++;
        aging["31-60"].entries.push(entry);
      } else {
        aging["60+"].amount += amount;
        aging["60+"].count++;
        aging["60+"].entries.push(entry);
      }

      // Group by client
      const clientId = entry.client_id || "sem-cliente";
      const clientName = (entry.clients as any)?.full_name || "Sem cliente";
      if (!byClient[clientId]) {
        byClient[clientId] = { name: clientName, amount: 0, count: 0, oldestDays: 0 };
      }
      byClient[clientId].amount += amount;
      byClient[clientId].count++;
      byClient[clientId].oldestDays = Math.max(byClient[clientId].oldestDays, daysOverdue);
    });

    const totalAmount = receivables.reduce((sum, e) => sum + (e.amount || 0), 0);
    const clientsList = Object.values(byClient).sort((a, b) => b.amount - a.amount);

    return {
      totalAmount,
      totalCount: receivables.length,
      aging,
      byClient: clientsList,
      avgDaysOverdue: receivables.length > 0 
        ? Math.round(receivables.reduce((sum, e) => {
            const daysOverdue = Math.floor((today.getTime() - new Date(e.due_date).getTime()) / (1000 * 60 * 60 * 24));
            return sum + daysOverdue;
          }, 0) / receivables.length)
        : 0
    };
  }, [overdueEntries, selectedBankId]);

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

  const isLoading = loadingBanks || loadingEntries || loadingOverdue;

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

        {/* Overdue Alert */}
        {overdueSummary && overdueSummary.total > 0 && (
          <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Lançamentos em Atraso</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="flex flex-wrap gap-4">
                {overdueSummary.receivableCount > 0 && (
                  <span>
                    <strong className="text-green-600">{formatCurrency(overdueSummary.receivables)}</strong> a receber ({overdueSummary.receivableCount} {overdueSummary.receivableCount === 1 ? 'lançamento' : 'lançamentos'})
                  </span>
                )}
                {overdueSummary.payableCount > 0 && (
                  <span>
                    <strong className="text-red-600">{formatCurrency(overdueSummary.payables)}</strong> a pagar ({overdueSummary.payableCount} {overdueSummary.payableCount === 1 ? 'lançamento' : 'lançamentos'})
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        ) : summary && (
          <div className="grid gap-4 md:grid-cols-5">
            {/* Overdue Card */}
            <Card className={overdueSummary?.total ? "border-orange-500/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${overdueSummary?.total ? "text-orange-500" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${overdueSummary?.total ? "text-orange-500" : "text-muted-foreground"}`}>
                  {formatCurrency(overdueSummary?.total || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(overdueSummary?.receivableCount || 0) + (overdueSummary?.payableCount || 0)} lançamentos
                </p>
              </CardContent>
            </Card>

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
          <TabsList className="bg-card/50 backdrop-blur-sm border">
            <TabsTrigger value="area" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Saldo Projetado
            </TabsTrigger>
            <TabsTrigger value="bars" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Entradas x Saídas
            </TabsTrigger>
            <TabsTrigger value="combined" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Combinado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="area">
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-background">
              <CardHeader className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  Evolução do Saldo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={projectionData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="hsl(var(--border))" 
                        strokeOpacity={0.5}
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="period" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        tickFormatter={(value) => {
                          if (Math.abs(value) >= 1000) {
                            return `${(value / 1000).toFixed(0)}k`;
                          }
                          return value.toString();
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        width={60}
                      />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover/95 backdrop-blur-md border border-border/50 rounded-xl p-4 shadow-xl">
                                <p className="font-semibold text-sm text-foreground mb-2">{label}</p>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-primary" />
                                  <span className="text-muted-foreground text-sm">Saldo:</span>
                                  <span className="font-bold text-foreground">
                                    {formatCurrency(payload[0].value as number)}
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="projectedBalance"
                        name="Saldo Projetado"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        fill="url(#balanceGradient)"
                        dot={false}
                        activeDot={{ 
                          r: 6, 
                          stroke: 'hsl(var(--background))', 
                          strokeWidth: 2,
                          fill: 'hsl(var(--primary))',
                          filter: 'url(#glow)'
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bars">
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-background">
              <CardHeader className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  Recebimentos vs Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={projectionData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="receivableGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="payableGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="hsl(var(--border))" 
                        strokeOpacity={0.5}
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="period" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        tickFormatter={(value) => {
                          if (Math.abs(value) >= 1000) {
                            return `${(value / 1000).toFixed(0)}k`;
                          }
                          return value.toString();
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        width={60}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover/95 backdrop-blur-md border border-border/50 rounded-xl p-4 shadow-xl">
                                <p className="font-semibold text-sm text-foreground mb-3">{label}</p>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-green-500" />
                                      <span className="text-muted-foreground text-sm">A Receber:</span>
                                    </div>
                                    <span className="font-bold text-green-600">
                                      {formatCurrency(payload[0]?.value as number || 0)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-red-500" />
                                      <span className="text-muted-foreground text-sm">A Pagar:</span>
                                    </div>
                                    <span className="font-bold text-red-600">
                                      {formatCurrency(payload[1]?.value as number || 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                        formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
                      />
                      <Bar 
                        dataKey="receivables" 
                        name="A Receber" 
                        fill="url(#receivableGradient)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      />
                      <Bar 
                        dataKey="payables" 
                        name="A Pagar" 
                        fill="url(#payableGradient)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combined">
            <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-background">
              <CardHeader className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  Visão Combinada
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoading ? (
                  <Skeleton className="h-[400px] w-full rounded-xl" />
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={projectionData} margin={{ top: 20, right: 60, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="receivableGradient2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#16a34a" stopOpacity={0.7} />
                        </linearGradient>
                        <linearGradient id="payableGradient2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#dc2626" stopOpacity={0.7} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="hsl(var(--border))" 
                        strokeOpacity={0.5}
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="period" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left"
                        tickFormatter={(value) => {
                          if (Math.abs(value) >= 1000) {
                            return `${(value / 1000).toFixed(0)}k`;
                          }
                          return value.toString();
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        width={60}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(value) => {
                          if (Math.abs(value) >= 1000) {
                            return `${(value / 1000).toFixed(0)}k`;
                          }
                          return value.toString();
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--primary))', fontSize: 12 }}
                        width={60}
                      />
                      <Tooltip 
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover/95 backdrop-blur-md border border-border/50 rounded-xl p-4 shadow-xl">
                                <p className="font-semibold text-sm text-foreground mb-3">{label}</p>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-green-500" />
                                      <span className="text-muted-foreground text-sm">A Receber:</span>
                                    </div>
                                    <span className="font-bold text-green-600">
                                      {formatCurrency(payload[0]?.value as number || 0)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-red-500" />
                                      <span className="text-muted-foreground text-sm">A Pagar:</span>
                                    </div>
                                    <span className="font-bold text-red-600">
                                      {formatCurrency(payload[1]?.value as number || 0)}
                                    </span>
                                  </div>
                                  <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-primary" />
                                      <span className="text-muted-foreground text-sm">Saldo:</span>
                                    </div>
                                    <span className="font-bold text-primary">
                                      {formatCurrency(payload[2]?.value as number || 0)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                        formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="receivables" 
                        name="A Receber" 
                        fill="url(#receivableGradient2)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                      />
                      <Bar 
                        yAxisId="left"
                        dataKey="payables" 
                        name="A Pagar" 
                        fill="url(#payableGradient2)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="projectedBalance" 
                        name="Saldo Projetado"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        dot={{ 
                          fill: 'hsl(var(--primary))', 
                          stroke: 'hsl(var(--background))', 
                          strokeWidth: 2,
                          r: 4
                        }}
                        activeDot={{ 
                          r: 7, 
                          stroke: 'hsl(var(--background))', 
                          strokeWidth: 2,
                          fill: 'hsl(var(--primary))'
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delinquency Analysis - Inadimplência */}
        {delinquencyAnalysis && (
          <Card className="border-red-500/30 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-red-500/10 to-transparent">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Users className="h-5 w-5" />
                </div>
                Análise de Inadimplência
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4 mb-6">
                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    Total Inadimplente
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(delinquencyAnalysis.totalAmount)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {delinquencyAnalysis.totalCount} {delinquencyAnalysis.totalCount === 1 ? 'título' : 'títulos'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Média de Atraso
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {delinquencyAnalysis.avgDaysOverdue} dias
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo médio em atraso
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    Clientes
                  </div>
                  <div className="text-2xl font-bold text-amber-600">
                    {delinquencyAnalysis.byClient.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Com pendências
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <PieChartIcon className="h-4 w-4" />
                    Crítico (60+ dias)
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(delinquencyAnalysis.aging["60+"].amount)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {delinquencyAnalysis.aging["60+"].count} títulos
                  </p>
                </div>
              </div>

              {/* Aging Analysis */}
              <div className="mb-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Análise por Aging
                </h4>
                <div className="space-y-3">
                  {[
                    { key: "1-15", label: "1-15 dias", color: "bg-yellow-500" },
                    { key: "16-30", label: "16-30 dias", color: "bg-orange-500" },
                    { key: "31-60", label: "31-60 dias", color: "bg-red-500" },
                    { key: "60+", label: "60+ dias", color: "bg-red-700" },
                  ].map(bucket => {
                    const data = delinquencyAnalysis.aging[bucket.key as keyof typeof delinquencyAnalysis.aging];
                    const percentage = delinquencyAnalysis.totalAmount > 0 
                      ? (data.amount / delinquencyAnalysis.totalAmount) * 100 
                      : 0;
                    return (
                      <div key={bucket.key} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-muted-foreground">{bucket.label}</div>
                        <div className="flex-1">
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${bucket.color} transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-32 text-right text-sm font-medium">
                          {formatCurrency(data.amount)}
                        </div>
                        <div className="w-16 text-right text-xs text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By Client */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Inadimplência por Cliente
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-3 px-4 text-left font-medium">Cliente</th>
                        <th className="py-3 px-4 text-center font-medium">Títulos</th>
                        <th className="py-3 px-4 text-center font-medium">Maior Atraso</th>
                        <th className="py-3 px-4 text-right font-medium">Valor Total</th>
                        <th className="py-3 px-4 text-right font-medium">% do Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delinquencyAnalysis.byClient.slice(0, 10).map((client, idx) => {
                        const percentage = (client.amount / delinquencyAnalysis.totalAmount) * 100;
                        return (
                          <tr key={idx} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 font-medium">{client.name}</td>
                            <td className="py-3 px-4 text-center">
                              <Badge variant="secondary">{client.count}</Badge>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge 
                                variant="outline" 
                                className={
                                  client.oldestDays > 60 ? "text-red-600 border-red-500" :
                                  client.oldestDays > 30 ? "text-orange-600 border-orange-500" :
                                  "text-yellow-600 border-yellow-500"
                                }
                              >
                                {client.oldestDays} dias
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right font-medium text-red-600">
                              {formatCurrency(client.amount)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress value={percentage} className="w-16 h-2" />
                                <span className="text-xs text-muted-foreground w-12">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {delinquencyAnalysis.byClient.length > 10 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      + {delinquencyAnalysis.byClient.length - 10} outros clientes
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overdue Table */}
        {overdueSummary && overdueSummary.entries.length > 0 && (
          <Card className="border-orange-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Lançamentos em Atraso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-4 text-left font-medium">Vencimento</th>
                      <th className="py-3 px-4 text-left font-medium">Descrição</th>
                      <th className="py-3 px-4 text-left font-medium">Cliente/Fornecedor</th>
                      <th className="py-3 px-4 text-left font-medium">Categoria</th>
                      <th className="py-3 px-4 text-center font-medium">Tipo</th>
                      <th className="py-3 px-4 text-right font-medium">Valor</th>
                      <th className="py-3 px-4 text-center font-medium">Dias Atraso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueSummary.entries.map((entry) => {
                      const daysOverdue = Math.floor((new Date().getTime() - new Date(entry.due_date).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={entry.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">
                            {format(new Date(entry.due_date), "dd/MM/yyyy")}
                          </td>
                          <td className="py-3 px-4">{entry.description}</td>
                          <td className="py-3 px-4">
                            {(entry.clients as any)?.full_name || "-"}
                          </td>
                          <td className="py-3 px-4">
                            {(entry.financial_categories as any)?.name && (
                              <Badge 
                                variant="outline" 
                                style={{ 
                                  borderColor: (entry.financial_categories as any)?.color || undefined,
                                  color: (entry.financial_categories as any)?.color || undefined
                                }}
                              >
                                {(entry.financial_categories as any)?.name}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={entry.entry_type === "receivable" ? "default" : "destructive"}>
                              {entry.entry_type === "receivable" ? "Receber" : "Pagar"}
                            </Badge>
                          </td>
                          <td className={`py-3 px-4 text-right font-medium ${entry.entry_type === "receivable" ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(entry.amount || 0)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="outline" className="text-orange-600 border-orange-500">
                              {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

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
