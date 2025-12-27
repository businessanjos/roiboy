import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DRELine {
  label: string;
  value: number;
  isTotal?: boolean;
  isSubtotal?: boolean;
  indent?: number;
}

interface DREData {
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  adminExpenses: number;
  salesExpenses: number;
  financialExpenses: number;
  depreciation: number;
  totalOperatingExpenses: number;
  operatingResult: number;
  ebitda: number;
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

export default function FinancialDREPage() {
  const [period, setPeriod] = useState("current_month");
  const dateRange = getDateRange(period);

  const { data: dreData, isLoading } = useQuery({
    queryKey: ["dre-report", period],
    queryFn: async () => {
      const startDate = format(dateRange.start, "yyyy-MM-dd");
      const endDate = format(dateRange.end, "yyyy-MM-dd");

      // Fetch all paid entries with their categories
      const { data: entries, error } = await supabase
        .from("financial_entries")
        .select(`
          id,
          entry_type,
          amount,
          payment_date,
          category_id,
          financial_categories (
            id,
            name,
            dre_group
          )
        `)
        .eq("status", "paid")
        .gte("payment_date", startDate)
        .lte("payment_date", endDate);

      if (error) throw error;

      // Calculate DRE values based on dre_group
      const dre: DREData = {
        grossRevenue: 0,
        deductions: 0,
        netRevenue: 0,
        cogs: 0,
        grossProfit: 0,
        adminExpenses: 0,
        salesExpenses: 0,
        financialExpenses: 0,
        depreciation: 0,
        totalOperatingExpenses: 0,
        operatingResult: 0,
        ebitda: 0,
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
            dre.grossRevenue += amount;
          } else {
            dre.adminExpenses += amount;
          }
          return;
        }

        switch (dreGroup) {
          case "gross_revenue":
            dre.grossRevenue += amount;
            break;
          case "deductions":
            dre.deductions += amount;
            break;
          case "cogs":
            dre.cogs += amount;
            break;
          case "admin_expenses":
            dre.adminExpenses += amount;
            break;
          case "sales_expenses":
            dre.salesExpenses += amount;
            break;
          case "financial_expenses":
            dre.financialExpenses += amount;
            break;
          case "depreciation":
            dre.depreciation += amount;
            break;
          case "other_revenue":
            dre.otherRevenue += amount;
            break;
          case "other_expenses":
            dre.otherExpenses += amount;
            break;
          default:
            // Fallback based on entry type
            if (entryType === "receivable") {
              dre.grossRevenue += amount;
            } else {
              dre.adminExpenses += amount;
            }
        }
      });

      // Calculate derived values
      dre.netRevenue = dre.grossRevenue - dre.deductions;
      dre.grossProfit = dre.netRevenue - dre.cogs;
      dre.totalOperatingExpenses = dre.adminExpenses + dre.salesExpenses + dre.financialExpenses + dre.depreciation;
      dre.operatingResult = dre.grossProfit - dre.totalOperatingExpenses;
      // EBITDA = Resultado Operacional + Despesas Financeiras + Depreciação/Amortização
      dre.ebitda = dre.operatingResult + dre.financialExpenses + dre.depreciation;
      dre.netResult = dre.operatingResult + dre.otherRevenue - dre.otherExpenses;

      return dre;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const dreLines: DRELine[] = dreData
    ? [
        { label: "RECEITA BRUTA", value: dreData.grossRevenue, isTotal: true },
        { label: "(-) Deduções", value: -dreData.deductions, indent: 1 },
        { label: "RECEITA LÍQUIDA", value: dreData.netRevenue, isSubtotal: true },
        { label: "(-) Custo dos Produtos/Serviços", value: -dreData.cogs, indent: 1 },
        { label: "LUCRO BRUTO", value: dreData.grossProfit, isSubtotal: true },
        { label: "(-) Despesas Operacionais", value: -dreData.totalOperatingExpenses, isTotal: true },
        { label: "Despesas Administrativas", value: -dreData.adminExpenses, indent: 2 },
        { label: "Despesas Comerciais", value: -dreData.salesExpenses, indent: 2 },
        { label: "Despesas Financeiras", value: -dreData.financialExpenses, indent: 2 },
        { label: "Depreciação e Amortização", value: -dreData.depreciation, indent: 2 },
        { label: "RESULTADO OPERACIONAL (EBIT)", value: dreData.operatingResult, isSubtotal: true },
        { label: "EBITDA", value: dreData.ebitda, isTotal: true },
        { label: "(+) Outras Receitas", value: dreData.otherRevenue, indent: 1 },
        { label: "(-) Outras Despesas", value: -dreData.otherExpenses, indent: 1 },
        { label: "RESULTADO LÍQUIDO", value: dreData.netResult, isTotal: true },
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
            <FileText className="h-6 w-6" />
            DRE - Demonstração do Resultado
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {periodLabel}: {periodRange}
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Receita Bruta</div>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(dreData?.grossRevenue || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Lucro Bruto</div>
            <div className={`text-2xl font-bold ${getValueColor(dreData?.grossProfit || 0)}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(dreData?.grossProfit || 0)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="text-sm text-amber-700 dark:text-amber-300 font-medium">EBITDA</div>
            <div className={`text-2xl font-bold ${dreData?.ebitda && dreData.ebitda >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600'}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(dreData?.ebitda || 0)}
            </div>
            {dreData && dreData.grossRevenue > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {((dreData.ebitda / dreData.grossRevenue) * 100).toFixed(1)}% da receita
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">EBIT (Res. Operacional)</div>
            <div className={`text-2xl font-bold ${getValueColor(dreData?.operatingResult || 0)}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(dreData?.operatingResult || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Resultado Líquido</div>
            <div className={`text-2xl font-bold ${getValueColor(dreData?.netResult || 0)}`}>
              {isLoading ? <Skeleton className="h-8 w-28" /> : formatCurrency(dreData?.netResult || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DRE Table */}
      <Card>
        <CardHeader>
          <CardTitle>Demonstrativo Detalhado</CardTitle>
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
              {dreLines.map((line, index) => (
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
      {dreData && dreData.grossRevenue > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análise de Margens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {((dreData.grossProfit / dreData.grossRevenue) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margem Bruta</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <div className={`text-3xl font-bold ${dreData.ebitda >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600'}`}>
                  {((dreData.ebitda / dreData.grossRevenue) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300 font-medium">Margem EBITDA</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getValueColor(dreData.operatingResult)}`}>
                  {((dreData.operatingResult / dreData.grossRevenue) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Margem EBIT</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getValueColor(dreData.netResult)}`}>
                  {((dreData.netResult / dreData.grossRevenue) * 100).toFixed(1)}%
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
            💡 Para classificar suas categorias no DRE, acesse{" "}
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
