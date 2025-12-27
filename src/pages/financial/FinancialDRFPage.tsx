import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";

interface DRFLine {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

interface DRFData {
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  adminExpenses: number;
  salesExpenses: number;
  financialExpenses: number;
  totalOperatingExpenses: number;
  operatingResult: number;
  otherRevenue: number;
  otherExpenses: number;
  netResult: number;
}

const periodOptions = [
  { value: "current_month", label: "Mês Atual" },
  { value: "last_month", label: "Mês Anterior" },
  { value: "last_3_months", label: "Últimos 3 Meses" },
  { value: "last_6_months", label: "Últimos 6 Meses" },
  { value: "current_year", label: "Ano Atual" },
  { value: "last_year", label: "Ano Anterior" },
];

function getDateRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  
  switch (period) {
    case "current_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "last_3_months":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "last_6_months":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case "current_year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "last_year":
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function FinancialDRFPage() {
  const [period, setPeriod] = useState("current_month");
  const dateRange = getDateRange(period);

  const { data: drfData, isLoading } = useQuery({
    queryKey: ["drf-report", period],
    queryFn: async () => {
      const startDate = format(dateRange.start, "yyyy-MM-dd");
      const endDate = format(dateRange.end, "yyyy-MM-dd");

      // Fetch all entries based on due_date (faturamento/competência)
      // Include all non-cancelled entries, not just paid ones
      const { data: entries, error } = await supabase
        .from("financial_entries")
        .select(`
          id,
          entry_type,
          amount,
          due_date,
          status,
          category_id,
          financial_categories (
            id,
            name,
            dre_group
          )
        `)
        .neq("status", "cancelled")
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      if (error) throw error;

      // Calculate DRF values based on dre_group
      const drf: DRFData = {
        grossRevenue: 0,
        deductions: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        adminExpenses: 0,
        salesExpenses: 0,
        financialExpenses: 0,
        totalOperatingExpenses: 0,
        operatingResult: 0,
        otherRevenue: 0,
        otherExpenses: 0,
        netResult: 0,
      };

      entries?.forEach((entry: any) => {
        const amount = Number(entry.amount) || 0;
        const dreGroup = entry.financial_categories?.dre_group;
        const entryType = entry.entry_type;

        // If no dre_group, use entry_type as fallback
        if (!dreGroup) {
          if (entryType === "receivable") {
            drf.grossRevenue += amount;
          } else {
            drf.adminExpenses += amount;
          }
          return;
        }

        switch (dreGroup) {
          case "gross_revenue":
            drf.grossRevenue += amount;
            break;
          case "deductions":
            drf.deductions += amount;
            break;
          case "cogs":
            drf.cogs += amount;
            break;
          case "admin_expenses":
            drf.adminExpenses += amount;
            break;
          case "sales_expenses":
            drf.salesExpenses += amount;
            break;
          case "financial_expenses":
            drf.financialExpenses += amount;
            break;
          case "other_revenue":
            drf.otherRevenue += amount;
            break;
          case "other_expenses":
            drf.otherExpenses += amount;
            break;
          default:
            // Fallback based on entry type
            if (entryType === "receivable") {
              drf.grossRevenue += amount;
            } else {
              drf.adminExpenses += amount;
            }
        }
      });

      // Calculate derived values
      drf.netRevenue = drf.grossRevenue - drf.deductions;
      drf.grossProfit = drf.netRevenue - drf.cogs;
      drf.totalOperatingExpenses = drf.adminExpenses + drf.salesExpenses + drf.financialExpenses;
      drf.operatingResult = drf.grossProfit - drf.totalOperatingExpenses;
      drf.netResult = drf.operatingResult + drf.otherRevenue - drf.otherExpenses;

      return drf;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const drfLines: DRFLine[] = drfData
    ? [
        { label: "RECEITA BRUTA FATURADA", value: drfData.grossRevenue, isTotal: true },
        { label: "(-) Deduções", value: -drfData.deductions, indent: 1 },
        { label: "RECEITA LÍQUIDA FATURADA", value: drfData.netRevenue, isSubtotal: true },
        { label: "(-) Custo dos Produtos/Serviços", value: -drfData.cogs, indent: 1 },
        { label: "LUCRO BRUTO", value: drfData.grossProfit, isSubtotal: true },
        { label: "(-) Despesas Operacionais", value: -drfData.totalOperatingExpenses, isTotal: true },
        { label: "Despesas Administrativas", value: -drfData.adminExpenses, indent: 2 },
        { label: "Despesas Comerciais", value: -drfData.salesExpenses, indent: 2 },
        { label: "Despesas Financeiras", value: -drfData.financialExpenses, indent: 2 },
        { label: "RESULTADO OPERACIONAL", value: drfData.operatingResult, isSubtotal: true },
        { label: "(+) Outras Receitas", value: drfData.otherRevenue, indent: 1 },
        { label: "(-) Outras Despesas", value: -drfData.otherExpenses, indent: 1 },
        { label: "RESULTADO LÍQUIDO", value: drfData.netResult, isTotal: true },
      ]
    : [];

  const getValueColor = (value: number) => {
    if (value > 0) return "text-emerald-600 dark:text-emerald-400";
    if (value < 0) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const getValueIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-emerald-600" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const periodLabel = periodOptions.find((p) => p.value === period)?.label || "Período";
  const periodRange = `${format(dateRange.start, "dd/MM/yyyy")} - ${format(dateRange.end, "dd/MM/yyyy")}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            DRF - Demonstração por Faturamento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Baseado em faturamento bruto (data de vencimento) • {periodLabel}: {periodRange}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" title="Exportar PDF">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Receita Bruta Faturada</div>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(drfData?.grossRevenue || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Lucro Bruto</div>
            <div className={`text-2xl font-bold ${getValueColor(drfData?.grossProfit || 0)}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(drfData?.grossProfit || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Resultado Operacional</div>
            <div className={`text-2xl font-bold ${getValueColor(drfData?.operatingResult || 0)}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(drfData?.operatingResult || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Resultado Líquido</div>
            <div className={`text-2xl font-bold ${getValueColor(drfData?.netResult || 0)}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(drfData?.netResult || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>DRF vs DRE:</strong> O DRF considera o faturamento bruto (data de vencimento), 
            independente de ter sido pago ou não. Já o DRE considera apenas os valores efetivamente recebidos.
          </p>
        </CardContent>
      </Card>

      {/* DRF Table */}
      <Card>
        <CardHeader>
          <CardTitle>Demonstrativo por Faturamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(13)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {drfLines.map((line, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center py-2 px-3 rounded-md ${
                    line.isTotal
                      ? "bg-muted font-bold"
                      : line.isSubtotal
                      ? "bg-muted/50 font-semibold"
                      : ""
                  }`}
                  style={{ paddingLeft: line.indent ? `${line.indent * 1.5 + 0.75}rem` : undefined }}
                >
                  <span className={line.isTotal || line.isSubtotal ? "" : "text-muted-foreground"}>
                    {line.label}
                  </span>
                  <div className="flex items-center gap-2">
                    {(line.isTotal || line.isSubtotal) && getValueIcon(line.value)}
                    <span className={getValueColor(line.value)}>
                      {formatCurrency(Math.abs(line.value))}
                      {line.value < 0 && !line.label.startsWith("(") && " (-)"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Margin Analysis */}
      {drfData && drfData.grossRevenue > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análise de Margens (Faturamento)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {((drfData.grossProfit / drfData.grossRevenue) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margem Bruta</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getValueColor(drfData.operatingResult)}`}>
                  {((drfData.operatingResult / drfData.grossRevenue) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margem Operacional</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getValueColor(drfData.netResult)}`}>
                  {((drfData.netResult / drfData.grossRevenue) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margem Líquida</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration hint */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            💡 Para classificar suas categorias no DRF, acesse{" "}
            <a href="/financial/categories" className="text-primary hover:underline">
              Categorias Financeiras
            </a>{" "}
            e defina o grupo DRE de cada categoria.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
