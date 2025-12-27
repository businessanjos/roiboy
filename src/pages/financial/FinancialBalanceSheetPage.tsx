import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, TrendingUp, TrendingDown, Scale, Building2, Wallet, Landmark, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceSheetData {
  assets: {
    current: {
      cash: number;
      receivables: number;
      inventory: number;
      prepaidExpenses: number;
      total: number;
    };
    nonCurrent: {
      fixedAssets: number;
      investments: number;
      intangible: number;
      total: number;
    };
    total: number;
  };
  liabilities: {
    current: {
      payables: number;
      shortTermLoans: number;
      accruedExpenses: number;
      deferredRevenue: number;
      total: number;
    };
    nonCurrent: {
      longTermLoans: number;
      provisions: number;
      total: number;
    };
    total: number;
  };
  equity: {
    capital: number;
    reserves: number;
    retainedEarnings: number;
    currentYearResult: number;
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export default function FinancialBalanceSheetPage() {
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["balance-sheet", referenceDate.toISOString()],
    queryFn: async (): Promise<BalanceSheetData> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: userProfile } = await supabase
        .from("users")
        .select("account_id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (!userProfile) throw new Error("User profile not found");

      const endDate = format(referenceDate, "yyyy-MM-dd");

      // Fetch bank accounts for cash/equivalents
      const { data: bankAccounts } = await supabase
        .from("bank_accounts")
        .select("current_balance, account_type")
        .eq("account_id", userProfile.account_id)
        .eq("is_active", true);

      const cashBalance = bankAccounts?.reduce((sum, acc) => sum + (acc.current_balance || 0), 0) || 0;

      // Fetch pending receivables (assets)
      const { data: receivables } = await supabase
        .from("financial_entries")
        .select("amount")
        .eq("account_id", userProfile.account_id)
        .eq("entry_type", "receivable")
        .eq("status", "pending")
        .lte("due_date", endDate);

      const receivablesTotal = receivables?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      // Fetch pending payables (liabilities)
      const { data: payables } = await supabase
        .from("financial_entries")
        .select("amount")
        .eq("account_id", userProfile.account_id)
        .eq("entry_type", "payable")
        .eq("status", "pending")
        .lte("due_date", endDate);

      const payablesTotal = payables?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      // Calculate current year result (profit/loss)
      const startOfYear = format(new Date(referenceDate.getFullYear(), 0, 1), "yyyy-MM-dd");
      
      const { data: yearlyRevenue } = await supabase
        .from("financial_entries")
        .select("amount")
        .eq("account_id", userProfile.account_id)
        .eq("entry_type", "receivable")
        .eq("status", "paid")
        .gte("payment_date", startOfYear)
        .lte("payment_date", endDate);

      const { data: yearlyExpenses } = await supabase
        .from("financial_entries")
        .select("amount")
        .eq("account_id", userProfile.account_id)
        .eq("entry_type", "payable")
        .eq("status", "paid")
        .gte("payment_date", startOfYear)
        .lte("payment_date", endDate);

      const totalRevenue = yearlyRevenue?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const totalExpenses = yearlyExpenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const currentYearResult = totalRevenue - totalExpenses;

      // Build balance sheet structure
      const assets = {
        current: {
          cash: cashBalance,
          receivables: receivablesTotal,
          inventory: 0, // Could be expanded with inventory module
          prepaidExpenses: 0,
          total: cashBalance + receivablesTotal,
        },
        nonCurrent: {
          fixedAssets: 0, // Could be expanded with fixed assets module
          investments: 0,
          intangible: 0,
          total: 0,
        },
        total: cashBalance + receivablesTotal,
      };

      const liabilities = {
        current: {
          payables: payablesTotal,
          shortTermLoans: 0,
          accruedExpenses: 0,
          deferredRevenue: 0,
          total: payablesTotal,
        },
        nonCurrent: {
          longTermLoans: 0,
          provisions: 0,
          total: 0,
        },
        total: payablesTotal,
      };

      // Equity = Assets - Liabilities (simplified)
      const equityTotal = assets.total - liabilities.total;
      
      const equity = {
        capital: 0, // Initial capital - would need to be configured
        reserves: 0,
        retainedEarnings: equityTotal - currentYearResult, // Previous years accumulated
        currentYearResult: currentYearResult,
        total: equityTotal,
      };

      return {
        assets,
        liabilities,
        equity,
        totalLiabilitiesAndEquity: liabilities.total + equity.total,
        isBalanced: Math.abs(assets.total - (liabilities.total + equity.total)) < 0.01,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const BalanceRow = ({ 
    label, 
    value, 
    level = 0, 
    isTotal = false,
    isSubtotal = false,
  }: { 
    label: string; 
    value: number; 
    level?: number; 
    isTotal?: boolean;
    isSubtotal?: boolean;
  }) => (
    <div 
      className={cn(
        "flex justify-between py-2 border-b border-border/50",
        level === 1 && "pl-4",
        level === 2 && "pl-8",
        isTotal && "font-bold text-lg border-t-2 border-foreground bg-muted/50",
        isSubtotal && "font-semibold bg-muted/30"
      )}
    >
      <span>{label}</span>
      <span className={cn(value < 0 && "text-destructive")}>
        {formatCurrency(value)}
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Balanço Patrimonial</h1>
          <p className="text-muted-foreground">
            Posição em {format(referenceDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(referenceDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={referenceDate}
                onSelect={(date) => date && setReferenceDate(date)}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Balance Check Card */}
      <Card className={cn(
        "border-2",
        data?.isBalanced ? "border-green-500/50 bg-green-500/5" : "border-destructive/50 bg-destructive/5"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scale className={cn(
                "h-8 w-8",
                data?.isBalanced ? "text-green-500" : "text-destructive"
              )} />
              <div>
                <p className="font-semibold">
                  {data?.isBalanced ? "Balanço Equilibrado" : "Balanço Desequilibrado"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Ativo Total = Passivo + Patrimônio Líquido
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(data?.assets.total || 0)}</p>
              <p className="text-sm text-muted-foreground">Ativo Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativo Total</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.assets.total || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-red-500/10">
                <TrendingDown className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Passivo Total</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.liabilities.total || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Landmark className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Patrimônio Líquido</p>
                <p className={cn(
                  "text-2xl font-bold",
                  (data?.equity.total || 0) < 0 && "text-destructive"
                )}>
                  {formatCurrency(data?.equity.total || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Sheet Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              ATIVO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-2">
              Ativo Circulante
            </div>
            <BalanceRow label="Caixa e Equivalentes" value={data?.assets.current.cash || 0} level={1} />
            <BalanceRow label="Contas a Receber" value={data?.assets.current.receivables || 0} level={1} />
            <BalanceRow label="Estoques" value={data?.assets.current.inventory || 0} level={1} />
            <BalanceRow label="Despesas Antecipadas" value={data?.assets.current.prepaidExpenses || 0} level={1} />
            <BalanceRow label="Total Ativo Circulante" value={data?.assets.current.total || 0} isSubtotal />

            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-2 mt-4">
              Ativo Não Circulante
            </div>
            <BalanceRow label="Imobilizado" value={data?.assets.nonCurrent.fixedAssets || 0} level={1} />
            <BalanceRow label="Investimentos" value={data?.assets.nonCurrent.investments || 0} level={1} />
            <BalanceRow label="Intangível" value={data?.assets.nonCurrent.intangible || 0} level={1} />
            <BalanceRow label="Total Ativo Não Circulante" value={data?.assets.nonCurrent.total || 0} isSubtotal />

            <div className="mt-4">
              <BalanceRow label="TOTAL DO ATIVO" value={data?.assets.total || 0} isTotal />
            </div>
          </CardContent>
        </Card>

        {/* Liabilities & Equity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-red-500" />
              PASSIVO E PATRIMÔNIO LÍQUIDO
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-2">
              Passivo Circulante
            </div>
            <BalanceRow label="Contas a Pagar" value={data?.liabilities.current.payables || 0} level={1} />
            <BalanceRow label="Empréstimos de Curto Prazo" value={data?.liabilities.current.shortTermLoans || 0} level={1} />
            <BalanceRow label="Provisões" value={data?.liabilities.current.accruedExpenses || 0} level={1} />
            <BalanceRow label="Receitas Diferidas" value={data?.liabilities.current.deferredRevenue || 0} level={1} />
            <BalanceRow label="Total Passivo Circulante" value={data?.liabilities.current.total || 0} isSubtotal />

            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-2 mt-4">
              Passivo Não Circulante
            </div>
            <BalanceRow label="Empréstimos de Longo Prazo" value={data?.liabilities.nonCurrent.longTermLoans || 0} level={1} />
            <BalanceRow label="Provisões de Longo Prazo" value={data?.liabilities.nonCurrent.provisions || 0} level={1} />
            <BalanceRow label="Total Passivo Não Circulante" value={data?.liabilities.nonCurrent.total || 0} isSubtotal />

            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide py-2 mt-4">
              Patrimônio Líquido
            </div>
            <BalanceRow label="Capital Social" value={data?.equity.capital || 0} level={1} />
            <BalanceRow label="Reservas" value={data?.equity.reserves || 0} level={1} />
            <BalanceRow label="Lucros Acumulados" value={data?.equity.retainedEarnings || 0} level={1} />
            <BalanceRow label="Resultado do Exercício" value={data?.equity.currentYearResult || 0} level={1} />
            <BalanceRow label="Total Patrimônio Líquido" value={data?.equity.total || 0} isSubtotal />

            <div className="mt-4">
              <BalanceRow label="TOTAL PASSIVO + PL" value={data?.totalLiabilitiesAndEquity || 0} isTotal />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Note */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Sobre este relatório</p>
              <p>
                Este balanço é calculado automaticamente com base nos lançamentos financeiros registrados.
                Para uma visão completa, configure as categorias de imobilizado, investimentos e capital social
                nas configurações financeiras.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
