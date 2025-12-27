import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  Download,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FinancialEntry {
  id: string;
  entry_type: string;
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  status: string;
  category_id: string | null;
  category?: { id: string; name: string; color: string; type: string } | null;
}

export default function FinancialReports() {
  const { currentUser } = useCurrentUser();
  const accountId = currentUser?.account_id;
  
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"dre" | "category" | "evolution">("dre");

  const dateRange = useMemo(() => {
    if (period === "month") {
      return {
        start: format(startOfMonth(currentDate), "yyyy-MM-dd"),
        end: format(endOfMonth(currentDate), "yyyy-MM-dd"),
        label: format(currentDate, "MMMM yyyy", { locale: ptBR }),
      };
    } else {
      return {
        start: format(startOfYear(currentDate), "yyyy-MM-dd"),
        end: format(endOfYear(currentDate), "yyyy-MM-dd"),
        label: format(currentDate, "yyyy"),
      };
    }
  }, [currentDate, period]);

  // Fetch paid entries for the period
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["financial-report", accountId, dateRange.start, dateRange.end],
    queryFn: async () => {
      if (!accountId) return [];
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select(`
          *,
          category:financial_categories(id, name, color, type)
        `)
        .eq("account_id", accountId)
        .eq("status", "paid")
        .gte("payment_date", dateRange.start)
        .lte("payment_date", dateRange.end)
        .order("payment_date", { ascending: true });
      
      if (error) throw error;
      return data as FinancialEntry[];
    },
    enabled: !!accountId,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["financial-categories", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch last 6 months for evolution
  const { data: evolutionData = [] } = useQuery({
    queryKey: ["financial-evolution", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        months.push({
          month: format(date, "MMM/yy", { locale: ptBR }),
          start: format(startOfMonth(date), "yyyy-MM-dd"),
          end: format(endOfMonth(date), "yyyy-MM-dd"),
        });
      }

      const results = await Promise.all(
        months.map(async (m) => {
          const { data, error } = await supabase
            .from("financial_entries")
            .select("entry_type, amount")
            .eq("account_id", accountId)
            .eq("status", "paid")
            .gte("payment_date", m.start)
            .lte("payment_date", m.end);

          if (error) throw error;
          
          const income = data?.filter(e => e.entry_type === "receivable").reduce((sum, e) => sum + e.amount, 0) || 0;
          const expense = data?.filter(e => e.entry_type === "payable").reduce((sum, e) => sum + e.amount, 0) || 0;
          
          return {
            month: m.month,
            income,
            expense,
            result: income - expense,
          };
        })
      );

      return results;
    },
    enabled: !!accountId && viewMode === "evolution",
  });

  // Calculate DRE data
  const dreData = useMemo(() => {
    const income = entries.filter(e => e.entry_type === "receivable");
    const expenses = entries.filter(e => e.entry_type === "payable");

    const totalIncome = income.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const result = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (result / totalIncome) * 100 : 0;

    // Group by category
    const incomeByCategory = income.reduce((acc, e) => {
      const catName = e.category?.name || "Sem categoria";
      const catColor = e.category?.color || "#6b7280";
      if (!acc[catName]) acc[catName] = { amount: 0, color: catColor };
      acc[catName].amount += e.amount;
      return acc;
    }, {} as Record<string, { amount: number; color: string }>);

    const expensesByCategory = expenses.reduce((acc, e) => {
      const catName = e.category?.name || "Sem categoria";
      const catColor = e.category?.color || "#6b7280";
      if (!acc[catName]) acc[catName] = { amount: 0, color: catColor };
      acc[catName].amount += e.amount;
      return acc;
    }, {} as Record<string, { amount: number; color: string }>);

    return {
      totalIncome,
      totalExpenses,
      result,
      margin,
      incomeByCategory: Object.entries(incomeByCategory)
        .map(([name, data]) => ({ name, ...data, percentage: (data.amount / totalIncome) * 100 }))
        .sort((a, b) => b.amount - a.amount),
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([name, data]) => ({ name, ...data, percentage: (data.amount / totalExpenses) * 100 }))
        .sort((a, b) => b.amount - a.amount),
    };
  }, [entries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const handlePreviousPeriod = () => {
    if (period === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    }
  };

  const handleNextPeriod = () => {
    if (period === "month") {
      setCurrentDate(subMonths(currentDate, -1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
          <p className="text-muted-foreground">DRE e análises financeiras</p>
        </div>
      </div>

      {/* Period Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handlePreviousPeriod}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-medium min-w-[180px] text-center capitalize">
            {dateRange.label}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNextPeriod}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as "month" | "year")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mensal</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="dre" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="category" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Por Categoria
          </TabsTrigger>
          <TabsTrigger value="evolution" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Evolução
          </TabsTrigger>
        </TabsList>

        {/* DRE View */}
        <TabsContent value="dre" className="space-y-6 mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : (
            <>
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
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(dreData.totalIncome)}
                    </div>
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
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(dreData.totalExpenses)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Resultado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${dreData.result >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(dreData.result)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Margem Líquida
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${dreData.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {dreData.margin.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* DRE Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Demonstrativo de Resultado</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Receitas */}
                      <TableRow className="bg-green-50 dark:bg-green-950/20">
                        <TableCell className="font-bold">RECEITAS BRUTAS</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(dreData.totalIncome)}
                        </TableCell>
                        <TableCell className="text-right font-bold">100%</TableCell>
                      </TableRow>
                      {dreData.incomeByCategory.map((cat) => (
                        <TableRow key={cat.name}>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(cat.amount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {cat.percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Despesas */}
                      <TableRow className="bg-red-50 dark:bg-red-950/20">
                        <TableCell className="font-bold">DESPESAS</TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          ({formatCurrency(dreData.totalExpenses)})
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {dreData.totalIncome > 0 ? ((dreData.totalExpenses / dreData.totalIncome) * 100).toFixed(1) : 0}%
                        </TableCell>
                      </TableRow>
                      {dreData.expensesByCategory.map((cat) => (
                        <TableRow key={cat.name}>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            ({formatCurrency(cat.amount)})
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {dreData.totalIncome > 0 ? ((cat.amount / dreData.totalIncome) * 100).toFixed(1) : 0}%
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Resultado */}
                      <TableRow className="border-t-2 border-foreground">
                        <TableCell className="font-bold text-lg">RESULTADO LÍQUIDO</TableCell>
                        <TableCell className={`text-right font-bold text-lg ${dreData.result >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(dreData.result)}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${dreData.margin >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {dreData.margin.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Category View */}
        <TabsContent value="category" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Income by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Receitas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dreData.incomeByCategory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Sem receitas no período</p>
                ) : (
                  dreData.incomeByCategory.map((cat) => (
                    <div key={cat.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                        <span className="font-medium">{formatCurrency(cat.amount)}</span>
                      </div>
                      <Progress value={cat.percentage} className="h-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Expenses by Category */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Despesas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dreData.expensesByCategory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Sem despesas no período</p>
                ) : (
                  dreData.expensesByCategory.map((cat) => (
                    <div key={cat.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                        <span className="font-medium">{formatCurrency(cat.amount)}</span>
                      </div>
                      <Progress value={cat.percentage} className="h-2" />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Evolution View */}
        <TabsContent value="evolution" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução Mensal (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Receitas</TableHead>
                    <TableHead className="text-right">Despesas</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evolutionData.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium capitalize">{row.month}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(row.income)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(row.expense)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${row.result >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(row.result)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {evolutionData.length > 0 && (
                    <TableRow className="border-t-2 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(evolutionData.reduce((sum, r) => sum + r.income, 0))}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(evolutionData.reduce((sum, r) => sum + r.expense, 0))}
                      </TableCell>
                      <TableCell className={`text-right ${evolutionData.reduce((sum, r) => sum + r.result, 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(evolutionData.reduce((sum, r) => sum + r.result, 0))}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
